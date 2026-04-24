import { Server, Socket } from 'socket.io';
import { UserService } from './db/user';
import { WalletService, ENTRY_FEE, FEE_PERCENT } from './db/wallet';
import { MatchService } from './db/match';
import { verifyToken } from './auth';
import { MemoryQueue } from './queue/QueueManager';
import { MatchManager, MatchPlayer } from './queue/MatchManager';
import { createGame } from './games/GamePlugin';

const queue = new MemoryQueue();
const matchManager = new MatchManager();
const GAME_DURATION = 30000;  // 30 seconds
const QUEUE_TIMEOUT = 60000;

export function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    let player: MatchPlayer | null = null;
    console.log('🔌 Connected:', socket.id);

    socket.on('set_name', async (data: string | { token?: string; name?: string }) => {
      try {
        let token: string | undefined, name: string | undefined;
        if (typeof data === 'string') { name = data; } else { token = data.token; name = data.name; }
        let user;
        if (token) { const d = verifyToken(token); if (d) user = await UserService.getById(d.id); }
        if (!user) { user = await UserService.findOrCreate(`dev_${socket.id}`, name || `Player_${Math.floor(Math.random() * 9999)}`); }
        player = { socketId: socket.id, dbId: user.id, name: user.displayName || `Player_${user.id}`, wallet: user.wallet!.balance.toNumber() };
        socket.join(`user:${player.dbId}`);
        socket.emit('wallet_update', player.wallet);
        broadcastOnline(io);
      } catch (err) { console.error('set_name error:', err); }
    });

    const handleJoinQueue = async (gameType: string) => {
      if (!player) return;
      if (matchManager.isPlayerBusy(socket.id)) { socket.emit('error_msg', 'คุณอยู่ในเกมอยู่แล้ว'); return; }
      const hasBalance = await WalletService.hasBalance(player.dbId, ENTRY_FEE);
      if (!hasBalance) { socket.emit('error_msg', `เงินไม่พอ! ต้องมีอย่างน้อย ฿${ENTRY_FEE}`); return; }
      const type = gameType || 'target_tap';
      const opponent = queue.findOpponent(type, socket.id);
      if (opponent) {
        const oppSocket = io.sockets.sockets.get(opponent.socketId);
        if (!oppSocket) { queue.add({ socketId: socket.id, dbId: player.dbId, name: player.name, gameType: type, joinedAt: Date.now() }); socket.emit('queued', { position: queue.size(type) }); return; }
        await doCreateMatch(io, socket, player, oppSocket, { socketId: opponent.socketId, dbId: opponent.dbId, name: opponent.name, wallet: 0 }, type);
      } else {
        queue.add({ socketId: socket.id, dbId: player.dbId, name: player.name, gameType: type, joinedAt: Date.now() });
        socket.emit('queued', { position: queue.size(type) });
      }
    };
    socket.on('JOIN_QUEUE', handleJoinQueue);
    socket.on('find_match', handleJoinQueue);

    const handleCancel = () => { queue.remove(socket.id); socket.emit('queue_cancelled'); };
    socket.on('CANCEL_QUEUE', handleCancel);
    socket.on('cancel_queue', handleCancel);

    const handleInput = (data: any) => {
      const matchId = typeof data === 'string' ? data : data?.matchId;
      const match = matchManager.get(matchId);
      if (!match || match.status !== 'ACTIVE') return;
      let input;
      if (typeof data === 'string') { input = { type: 'tap', time: Date.now() - (match.startedAt || 0), data: {} }; }
      else { input = { type: data.type || 'tap', time: data.time || (Date.now() - (match.startedAt || 0)), data: data.data || {} }; }
      const newScore = matchManager.processInput(matchId, socket.id, input);
      if (newScore === null) return;
      socket.emit('your_score', newScore);
      socket.emit('SCORE_UPDATE', { you: newScore });
      const oppId = matchManager.getOpponentSocketId(matchId, socket.id);
      if (oppId) { io.to(oppId).emit('opponent_tap', newScore); io.to(oppId).emit('OPPONENT_SCORE', { score: newScore }); }
    };
    socket.on('GAME_INPUT', handleInput);
    socket.on('tap', handleInput);

    socket.on('disconnect', async () => {
      console.log('🔌 Disconnected:', player?.name || socket.id);
      queue.remove(socket.id);
      const match = matchManager.getByPlayer(socket.id);
      if (match && match.status === 'ACTIVE') {
        const winner = match.p1.socketId === socket.id ? match.p2 : match.p1;
        const loser = match.p1.socketId === socket.id ? match.p1 : match.p2;
        await endMatch(io, match.id, winner, loser, 'opponent_disconnected');
      }
      broadcastOnline(io);
    });
  });

  setInterval(() => { const expired = queue.cleanup(QUEUE_TIMEOUT); expired.forEach(e => { const s = io.sockets.sockets.get(e.socketId); if (s) s.emit('queue_timeout'); }); }, 5000);
  setInterval(() => broadcastOnline(io), 10000);
}

async function doCreateMatch(io: Server, s1: Socket, p1: MatchPlayer, s2: Socket, p2: MatchPlayer, gameType: string) {
  const matchId = `M${Date.now()}${Math.floor(Math.random() * 1000)}`;
  try {
    p1.wallet = await WalletService.deductEntryFee(p1.dbId, matchId);
    p2.wallet = await WalletService.deductEntryFee(p2.dbId, matchId);
    await MatchService.createMatch(matchId, gameType, p1.dbId, p2.dbId);
  } catch (err) {
    console.error('Match creation failed:', err);
    try { await WalletService.refundPlayer(p1.dbId, matchId, 'failed'); } catch {}
    try { await WalletService.refundPlayer(p2.dbId, matchId, 'failed'); } catch {}
    s1.emit('error_msg', 'Match failed, refunded'); s2.emit('error_msg', 'Match failed, refunded'); return;
  }
  const game = createGame(gameType, GAME_DURATION);
  const gameConfig = game.generateConfig();
  const match = matchManager.create(matchId, gameType, p1, p2, game);
  s1.join(match.roomId); s2.join(match.roomId);
  s1.emit('wallet_update', p1.wallet); s2.emit('wallet_update', p2.wallet);
  const prize = (ENTRY_FEE * 2) * (1 - FEE_PERCENT / 100);
  const md = (you: string, opp: string) => ({ matchId, gameType, opponent: opp, you, prize: prize.toFixed(2), gameConfig });
  s1.emit('match_found', md(p1.name, p2.name)); s2.emit('match_found', md(p2.name, p1.name));
  let count = 3;
  const interval = setInterval(() => { io.to(match.roomId).emit('countdown', count); count--; if (count < 0) { clearInterval(interval); startGame(io, matchId); } }, 1000);
}

function startGame(io: Server, matchId: string) {
  const match = matchManager.startGame(matchId);
  if (!match) return;
  io.to(match.roomId).emit('game_start', { matchId, duration: GAME_DURATION, gameType: match.gameType });
  setTimeout(() => { const m = matchManager.get(matchId); if (m && m.status === 'ACTIVE') resolveMatch(io, matchId); }, GAME_DURATION + 500);
}

async function resolveMatch(io: Server, matchId: string) {
  const match = matchManager.get(matchId);
  if (!match || match.status === 'FINISHED') return;
  const s1 = match.game.getScore(match.p1.socketId);
  const s2 = match.game.getScore(match.p2.socketId);
  const v1 = match.game.validate(match.p1.socketId);
  const v2 = match.game.validate(match.p2.socketId);
  const f1 = v1 ? s1 : 0, f2 = v2 ? s2 : 0;
  if (f1 > f2) await endMatch(io, matchId, match.p1, match.p2, 'win');
  else if (f2 > f1) await endMatch(io, matchId, match.p2, match.p1, 'win');
  else await endMatch(io, matchId, null, null, 'draw');
}

async function endMatch(io: Server, matchId: string, winner: MatchPlayer | null, loser: MatchPlayer | null, reason: string) {
  const match = matchManager.finish(matchId);
  if (!match) return;
  const prize = (ENTRY_FEE * 2) * (1 - FEE_PERCENT / 100);
  const s1 = match.game.getScore(match.p1.socketId), s2 = match.game.getScore(match.p2.socketId);
  try {
    await MatchService.saveResult(matchId, match.p1.dbId, s1, {});
    await MatchService.saveResult(matchId, match.p2.dbId, s2, {});
    if (reason === 'draw') {
      const w1 = await WalletService.refundPlayer(match.p1.dbId, matchId, 'draw');
      const w2 = await WalletService.refundPlayer(match.p2.dbId, matchId, 'draw');
      await MatchService.finishMatch(matchId, null, true);
      await MatchService.updateLeaderboard(match.p1.dbId, match.gameType, 'draw');
      await MatchService.updateLeaderboard(match.p2.dbId, match.gameType, 'draw');
      const d = (ys: number, os: number) => ({ result: 'draw', yourScore: ys, oppScore: os, prize: 0, refund: ENTRY_FEE });
      io.to(match.p1.socketId).emit('match_result', d(s1, s2)); io.to(match.p2.socketId).emit('match_result', d(s2, s1));
      io.to(match.p1.socketId).emit('wallet_update', w1); io.to(match.p2.socketId).emit('wallet_update', w2);
    } else if (winner && loser) {
      const payout = await WalletService.payWinner(winner.dbId, matchId);
      const lw = await WalletService.getWallet(loser.dbId);
      await MatchService.finishMatch(matchId, winner.dbId, false);
      await MatchService.updateLeaderboard(winner.dbId, match.gameType, 'win', payout.prize);
      await MatchService.updateLeaderboard(loser.dbId, match.gameType, 'loss');
      io.to(winner.socketId).emit('match_result', { result: 'win', yourScore: match.game.getScore(winner.socketId), oppScore: match.game.getScore(loser.socketId), prize, reason });
      io.to(loser.socketId).emit('match_result', { result: 'lose', yourScore: match.game.getScore(loser.socketId), oppScore: match.game.getScore(winner.socketId), prize: 0, reason });
      io.to(winner.socketId).emit('wallet_update', payout.newBalance); io.to(loser.socketId).emit('wallet_update', lw.balance.toNumber());
    }
  } catch (err) { console.error('endMatch error:', err); }
  const s1s = io.sockets.sockets.get(match.p1.socketId), s2s = io.sockets.sockets.get(match.p2.socketId);
  if (s1s) s1s.leave(match.roomId); if (s2s) s2s.leave(match.roomId);
}

function broadcastOnline(io: Server) { io.emit('online_count', io.engine.clientsCount); }
export function getSystemStats() { return { queueSize: queue.size(), matches: matchManager.stats() }; }
