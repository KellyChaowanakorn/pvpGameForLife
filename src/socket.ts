import { Server, Socket } from 'socket.io';
import { UserService } from './db/user';
import { WalletService, ENTRY_FEE, FEE_PERCENT } from './db/wallet';
import { MatchService } from './db/match';
import { verifyToken } from './auth';

interface Player {
  socket: Socket;
  dbId: number;
  name: string;
  wallet: number;
}

interface QueueEntry {
  player: Player;
  gameType: string;
  joinedAt: number;
}

interface ActiveMatch {
  id: string;
  gameType: string;
  p1: Player;
  p2: Player;
  scores: Record<string, number>;
  dbIds: Record<string, number>;
  taps: Record<string, number[]>;
  status: 'countdown' | 'playing' | 'finished';
  startedAt: number | null;
}

const queue: QueueEntry[] = [];
const activeMatches: Record<string, ActiveMatch> = {};
const GAME_DURATION = 5000;
const MAX_TAPS = 100;
const QUEUE_TIMEOUT = 60000;

export function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    let player: Player | null = null;
    console.log('🔌 Connected:', socket.id);

    socket.on('set_name', async (data: string | { token?: string; name?: string }) => {
      try {
        // Support both: JWT token auth (from LIFF) and simple name (dev mode)
        let token: string | undefined;
        let name: string | undefined;

        if (typeof data === 'string') {
          name = data;
        } else {
          token = data.token;
          name = data.name;
        }

        let user;

        if (token) {
          // JWT auth - user already logged in via /api/auth/login
          const decoded = verifyToken(token);
          if (decoded) {
            user = await UserService.getById(decoded.id);
          }
        }

        if (!user) {
          // Fallback: dev mode - create temp user
          const playerName = name || `Player_${Math.floor(Math.random() * 9999)}`;
          const lineUserId = `dev_${socket.id}`;
          user = await UserService.findOrCreate(lineUserId, playerName);
        }

        player = {
          socket, dbId: user.id,
          name: user.displayName || `Player_${user.id}`,
          wallet: user.wallet!.balance.toNumber(),
        };
        socket.emit('wallet_update', player.wallet);
        broadcastOnline(io);
      } catch (err) {
        console.error('set_name error:', err);
      }
    });

    socket.on('find_match', async (gameType: string) => {
      if (!player) return;
      if ((socket as any).inMatch) {
        socket.emit('error_msg', 'คุณอยู่ในเกมอยู่แล้ว');
        return;
      }
      const hasBalance = await WalletService.hasBalance(player.dbId, ENTRY_FEE);
      if (!hasBalance) {
        socket.emit('error_msg', `เงินไม่พอ! ต้องมีอย่างน้อย ฿${ENTRY_FEE}`);
        return;
      }
      const type = gameType || 'tap_battle';
      const idx = queue.findIndex(q => q.gameType === type && q.player.socket.id !== socket.id);
      if (idx >= 0) {
        const opponent = queue.splice(idx, 1)[0];
        await createMatch(io, player, opponent.player, type);
      } else {
        queue.push({ player, gameType: type, joinedAt: Date.now() });
        (socket as any).inQueue = true;
        socket.emit('queued', { position: queue.length });
      }
    });

    socket.on('cancel_queue', () => {
      removeFromQueue(socket);
      socket.emit('queue_cancelled');
    });

    socket.on('tap', (matchId: string) => {
      const match = activeMatches[matchId];
      if (!match || match.status !== 'playing') return;
      const pid = socket.id;
      if (match.scores[pid] === undefined) return;
      match.scores[pid]++;
      match.taps[pid].push(Date.now());
      const oppId = match.p1.socket.id === pid ? match.p2.socket.id : match.p1.socket.id;
      io.to(oppId).emit('opponent_tap', match.scores[pid]);
      socket.emit('your_score', match.scores[pid]);
    });

    socket.on('disconnect', async () => {
      console.log('🔌 Disconnected:', player?.name || socket.id);
      removeFromQueue(socket);
      await handleDisconnect(io, socket);
      broadcastOnline(io);
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (let i = queue.length - 1; i >= 0; i--) {
      if (now - queue[i].joinedAt > QUEUE_TIMEOUT) {
        queue[i].player.socket.emit('queue_timeout');
        queue.splice(i, 1);
      }
    }
  }, 5000);

  setInterval(() => broadcastOnline(io), 10000);
}

async function createMatch(io: Server, p1: Player, p2: Player, gameType: string) {
  const matchId = `M${Date.now()}${Math.floor(Math.random() * 1000)}`;
  try {
    p1.wallet = await WalletService.deductEntryFee(p1.dbId, matchId);
    p2.wallet = await WalletService.deductEntryFee(p2.dbId, matchId);
    await MatchService.createMatch(matchId, gameType, p1.dbId, p2.dbId);
  } catch (err) {
    console.error('Match creation failed:', err);
    try { await WalletService.refundPlayer(p1.dbId, matchId, 'failed'); } catch {}
    try { await WalletService.refundPlayer(p2.dbId, matchId, 'failed'); } catch {}
    p1.socket.emit('error_msg', 'Match failed, refunded');
    p2.socket.emit('error_msg', 'Match failed, refunded');
    return;
  }

  p1.socket.emit('wallet_update', p1.wallet);
  p2.socket.emit('wallet_update', p2.wallet);
  (p1.socket as any).inMatch = matchId;
  (p2.socket as any).inMatch = matchId;

  const match: ActiveMatch = {
    id: matchId, gameType, p1, p2,
    scores: { [p1.socket.id]: 0, [p2.socket.id]: 0 },
    dbIds: { [p1.socket.id]: p1.dbId, [p2.socket.id]: p2.dbId },
    taps: { [p1.socket.id]: [], [p2.socket.id]: [] },
    status: 'countdown', startedAt: null,
  };
  activeMatches[matchId] = match;

  const prize = (ENTRY_FEE * 2) * (1 - FEE_PERCENT / 100);
  p1.socket.emit('match_found', { matchId, opponent: p2.name, you: p1.name, prize: prize.toFixed(2) });
  p2.socket.emit('match_found', { matchId, opponent: p1.name, you: p2.name, prize: prize.toFixed(2) });
  console.log('⚔️ Match:', p1.name, 'vs', p2.name, '|', matchId);

  let count = 3;
  const interval = setInterval(() => {
    p1.socket.emit('countdown', count);
    p2.socket.emit('countdown', count);
    count--;
    if (count < 0) { clearInterval(interval); startGame(io, matchId); }
  }, 1000);
}

function startGame(io: Server, matchId: string) {
  const match = activeMatches[matchId];
  if (!match) return;
  match.status = 'playing';
  match.startedAt = Date.now();
  const data = { matchId, duration: GAME_DURATION };
  match.p1.socket.emit('game_start', data);
  match.p2.socket.emit('game_start', data);
  setTimeout(() => {
    if (match.status === 'playing') resolveMatch(io, matchId);
  }, GAME_DURATION + 500);
}

async function resolveMatch(io: Server, matchId: string) {
  const match = activeMatches[matchId];
  if (!match || match.status === 'finished') return;
  const s1 = match.scores[match.p1.socket.id] || 0;
  const s2 = match.scores[match.p2.socket.id] || 0;
  const v1 = s1 <= MAX_TAPS ? s1 : 0;
  const v2 = s2 <= MAX_TAPS ? s2 : 0;
  if (v1 > v2) await endMatch(matchId, match.p1, match.p2, 'win');
  else if (v2 > v1) await endMatch(matchId, match.p2, match.p1, 'win');
  else await endMatch(matchId, null, null, 'draw');
}

async function endMatch(matchId: string, winner: Player | null, loser: Player | null, reason: string) {
  const match = activeMatches[matchId];
  if (!match || match.status === 'finished') return;
  match.status = 'finished';

  const prize = (ENTRY_FEE * 2) * (1 - FEE_PERCENT / 100);
  const s1 = match.scores[match.p1.socket.id] || 0;
  const s2 = match.scores[match.p2.socket.id] || 0;

  try {
    // Save scores to DB
    await MatchService.saveResult(matchId, match.p1.dbId, s1, { taps: match.taps[match.p1.socket.id] });
    await MatchService.saveResult(matchId, match.p2.dbId, s2, { taps: match.taps[match.p2.socket.id] });

    if (reason === 'draw') {
      match.p1.wallet = await WalletService.refundPlayer(match.p1.dbId, matchId, 'draw');
      match.p2.wallet = await WalletService.refundPlayer(match.p2.dbId, matchId, 'draw');
      await MatchService.finishMatch(matchId, null, true);
      await MatchService.updateLeaderboard(match.p1.dbId, match.gameType, 'draw');
      await MatchService.updateLeaderboard(match.p2.dbId, match.gameType, 'draw');
      match.p1.socket.emit('wallet_update', match.p1.wallet);
      match.p2.socket.emit('wallet_update', match.p2.wallet);
      match.p1.socket.emit('match_result', { result: 'draw', yourScore: s1, oppScore: s2, prize: 0, refund: ENTRY_FEE });
      match.p2.socket.emit('match_result', { result: 'draw', yourScore: s2, oppScore: s1, prize: 0, refund: ENTRY_FEE });
    } else if (winner && loser) {
      const payout = await WalletService.payWinner(winner.dbId, matchId);
      winner.wallet = payout.newBalance;
      const loserWallet = await WalletService.getWallet(loser.dbId);
      loser.wallet = loserWallet.balance.toNumber();
      await MatchService.finishMatch(matchId, winner.dbId, false);
      await MatchService.updateLeaderboard(winner.dbId, match.gameType, 'win', payout.prize);
      await MatchService.updateLeaderboard(loser.dbId, match.gameType, 'loss');
      winner.socket.emit('wallet_update', winner.wallet);
      loser.socket.emit('wallet_update', loser.wallet);
      winner.socket.emit('match_result', {
        result: 'win', yourScore: match.scores[winner.socket.id] || 0,
        oppScore: match.scores[loser.socket.id] || 0, prize, reason,
      });
      loser.socket.emit('match_result', {
        result: 'lose', yourScore: match.scores[loser.socket.id] || 0,
        oppScore: match.scores[winner.socket.id] || 0, prize: 0, reason,
      });
    }
  } catch (err) {
    console.error('endMatch DB error:', err);
  }

  (match.p1.socket as any).inMatch = null;
  (match.p2.socket as any).inMatch = null;
  setTimeout(() => delete activeMatches[matchId], 30000);
  console.log('🏆 Match ended:', matchId, reason === 'draw' ? 'DRAW' : `${winner?.name} wins`);
}

function removeFromQueue(socket: Socket) {
  const idx = queue.findIndex(q => q.player.socket.id === socket.id);
  if (idx >= 0) queue.splice(idx, 1);
}

async function handleDisconnect(io: Server, socket: Socket) {
  for (const matchId in activeMatches) {
    const match = activeMatches[matchId];
    if (match.status !== 'playing') continue;
    if (match.p1.socket.id === socket.id) {
      await endMatch(matchId, match.p2, match.p1, 'opponent_disconnected');
      break;
    }
    if (match.p2.socket.id === socket.id) {
      await endMatch(matchId, match.p1, match.p2, 'opponent_disconnected');
      break;
    }
  }
}

function broadcastOnline(io: Server) {
  io.emit('online_count', io.engine.clientsCount);
}
