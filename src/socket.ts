import { Server, Socket } from 'socket.io';
import { UserService } from './db/user';
import { WalletService, ENTRY_FEE, FEE_PERCENT } from './db/wallet';
import { MatchService } from './db/match';
import { verifyToken } from './auth';
import { MemoryQueue } from './queue/QueueManager';
import { MatchManager, MatchPlayer } from './queue/MatchManager';

// ===== INSTANCES =====
const queue = new MemoryQueue();          // swap to RedisQueue later
const matchManager = new MatchManager();

const GAME_DURATION = 5000;
const MAX_TAPS = 100;     // anti-cheat: max taps in 5s
const QUEUE_TIMEOUT = 60000;

// ===== SETUP =====
export function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    let player: MatchPlayer | null = null;

    console.log('🔌 Connected:', socket.id);

    // ============================
    // EVENT: set_name (auth)
    // ============================
    socket.on('set_name', async (data: string | { token?: string; name?: string }) => {
      try {
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
          const decoded = verifyToken(token);
          if (decoded) {
            user = await UserService.getById(decoded.id);
          }
        }

        if (!user) {
          const playerName = name || `Player_${Math.floor(Math.random() * 9999)}`;
          const lineUserId = `dev_${socket.id}`;
          user = await UserService.findOrCreate(lineUserId, playerName);
        }

        player = {
          socketId: socket.id,
          dbId: user.id,
          name: user.displayName || `Player_${user.id}`,
          wallet: user.wallet!.balance.toNumber(),
        };

        // Join personal room
        socket.join(`user:${player.dbId}`);

        socket.emit('wallet_update', player.wallet);
        broadcastOnline(io);
        broadcastQueueStatus(io);

        console.log(`👤 ${player.name} (DB:${player.dbId}) ready`);
      } catch (err) {
        console.error('set_name error:', err);
      }
    });

    // ============================
    // EVENT: JOIN_QUEUE
    // ============================
    socket.on('JOIN_QUEUE', async (gameType: string) => {
      if (!player) return;

      // Check if already in match
      if (matchManager.isPlayerBusy(socket.id)) {
        socket.emit('ERROR', { code: 'IN_MATCH', message: 'คุณอยู่ในเกมอยู่แล้ว' });
        return;
      }

      // Check balance from DB
      const hasBalance = await WalletService.hasBalance(player.dbId, ENTRY_FEE);
      if (!hasBalance) {
        socket.emit('ERROR', { code: 'NO_BALANCE', message: `เงินไม่พอ! ต้องมีอย่างน้อย ฿${ENTRY_FEE}` });
        return;
      }

      const type = gameType || 'tap_battle';

      // Try to find opponent
      const opponent = queue.findOpponent(type, socket.id);

      if (opponent) {
        // Match found! Get opponent socket
        const oppSocket = io.sockets.sockets.get(opponent.socketId);
        if (!oppSocket) {
          // Opponent disconnected, add self to queue
          queue.add({ socketId: socket.id, dbId: player.dbId, name: player.name, gameType: type, joinedAt: Date.now() });
          socket.emit('QUEUED', { position: queue.size(type), gameType: type });
          return;
        }

        await createMatch(io, socket, player, oppSocket, {
          socketId: opponent.socketId,
          dbId: opponent.dbId,
          name: opponent.name,
          wallet: 0, // will be refreshed
        }, type);
      } else {
        // No opponent, join queue
        queue.add({
          socketId: socket.id,
          dbId: player.dbId,
          name: player.name,
          gameType: type,
          joinedAt: Date.now(),
        });

        socket.emit('QUEUED', { position: queue.size(type), gameType: type });
        broadcastQueueStatus(io);
      }
    });

    // ============================
    // EVENT: CANCEL_QUEUE
    // ============================
    socket.on('CANCEL_QUEUE', () => {
      queue.remove(socket.id);
      socket.emit('QUEUE_CANCELLED');
      broadcastQueueStatus(io);
    });

    // ============================
    // EVENT: GAME_INPUT (tap)
    // ============================
    socket.on('GAME_INPUT', ({ matchId, type }: { matchId: string; type: string }) => {
      if (type !== 'tap') return;

      const newScore = matchManager.addTap(matchId, socket.id);
      if (newScore === null) return;

      // Send score to self
      socket.emit('SCORE_UPDATE', { you: newScore });

      // Send score to opponent via room
      const oppId = matchManager.getOpponentSocketId(matchId, socket.id);
      if (oppId) {
        io.to(oppId).emit('OPPONENT_SCORE', { score: newScore });
      }
    });

    // ============================
    // EVENT: disconnect
    // ============================
    socket.on('disconnect', async () => {
      console.log('🔌 Disconnected:', player?.name || socket.id);

      // Remove from queue
      queue.remove(socket.id);

      // Handle disconnect during match
      const match = matchManager.getByPlayer(socket.id);
      if (match && match.status === 'ACTIVE') {
        const winner = match.p1.socketId === socket.id ? match.p2 : match.p1;
        const loser = match.p1.socketId === socket.id ? match.p1 : match.p2;
        await endMatch(io, match.id, winner, loser, 'opponent_disconnected');
      }

      broadcastOnline(io);
      broadcastQueueStatus(io);
    });

    // ============================
    // LEGACY EVENTS (fallback HTML uses these names)
    // ============================
    socket.on('find_match', async (gameType: string) => {
      if (!player) return;
      if (matchManager.isPlayerBusy(socket.id)) {
        socket.emit('error_msg', 'คุณอยู่ในเกมอยู่แล้ว');
        return;
      }
      const hasBalance = await WalletService.hasBalance(player.dbId, ENTRY_FEE);
      if (!hasBalance) {
        socket.emit('error_msg', `เงินไม่พอ! ต้องมีอย่างน้อย ฿${ENTRY_FEE}`);
        return;
      }
      const type = gameType || 'tap_battle';
      const opponent = queue.findOpponent(type, socket.id);
      if (opponent) {
        const oppSocket = io.sockets.sockets.get(opponent.socketId);
        if (!oppSocket) {
          queue.add({ socketId: socket.id, dbId: player.dbId, name: player.name, gameType: type, joinedAt: Date.now() });
          socket.emit('queued', { position: queue.size(type) });
          return;
        }
        await createMatch(io, socket, player, oppSocket, {
          socketId: opponent.socketId, dbId: opponent.dbId, name: opponent.name, wallet: 0,
        }, type);
      } else {
        queue.add({ socketId: socket.id, dbId: player.dbId, name: player.name, gameType: type, joinedAt: Date.now() });
        socket.emit('queued', { position: queue.size(type) });
      }
    });

    socket.on('cancel_queue', () => {
      queue.remove(socket.id);
      socket.emit('queue_cancelled');
    });

    socket.on('tap', (matchId: string) => {
      const newScore = matchManager.addTap(matchId, socket.id);
      if (newScore === null) return;
      socket.emit('your_score', newScore);
      const oppId = matchManager.getOpponentSocketId(matchId, socket.id);
      if (oppId) io.to(oppId).emit('opponent_tap', newScore);
    });
  });

  // ===== CLEANUP TIMERS =====
  // Expire stale queue entries
  setInterval(() => {
    const expired = queue.cleanup(QUEUE_TIMEOUT);
    expired.forEach((entry) => {
      const s = io.sockets.sockets.get(entry.socketId);
      if (s) s.emit('QUEUE_TIMEOUT');
    });
  }, 5000);

  // Broadcast online count
  setInterval(() => broadcastOnline(io), 10000);
}

// ===== MATCH LIFECYCLE =====
async function createMatch(
  io: Server,
  s1: Socket, p1: MatchPlayer,
  s2: Socket, p2: MatchPlayer,
  gameType: string
) {
  const matchId = `M${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Deduct entry fees in DB
  try {
    p1.wallet = await WalletService.deductEntryFee(p1.dbId, matchId);
    p2.wallet = await WalletService.deductEntryFee(p2.dbId, matchId);
    await MatchService.createMatch(matchId, gameType, p1.dbId, p2.dbId);
  } catch (err) {
    console.error('Match creation failed:', err);
    try { await WalletService.refundPlayer(p1.dbId, matchId, 'failed'); } catch {}
    try { await WalletService.refundPlayer(p2.dbId, matchId, 'failed'); } catch {}
    s1.emit('ERROR', { code: 'MATCH_FAILED', message: 'Match failed, refunded' });
    s2.emit('ERROR', { code: 'MATCH_FAILED', message: 'Match failed, refunded' });
    return;
  }

  // Create match in state machine
  const match = matchManager.create(matchId, gameType, p1, p2);

  // Both players join Socket.IO room
  s1.join(match.roomId);
  s2.join(match.roomId);

  // Notify wallets
  s1.emit('wallet_update', p1.wallet);
  s2.emit('wallet_update', p2.wallet);

  const prize = (ENTRY_FEE * 2) * (1 - FEE_PERCENT / 100);

  // EVENT: MATCH_FOUND → both players
  s1.emit('MATCH_FOUND', { matchId, opponent: p2.name, you: p1.name, prize: prize.toFixed(2) });
  s2.emit('MATCH_FOUND', { matchId, opponent: p1.name, you: p2.name, prize: prize.toFixed(2) });

  // Legacy events (for fallback HTML)
  s1.emit('match_found', { matchId, opponent: p2.name, you: p1.name, prize: prize.toFixed(2) });
  s2.emit('match_found', { matchId, opponent: p1.name, you: p2.name, prize: prize.toFixed(2) });

  console.log(`⚔️ MATCH_FOUND: ${p1.name} vs ${p2.name} | Room: ${match.roomId}`);

  // COUNTDOWN: 3 → 2 → 1 → START
  let count = 3;
  const interval = setInterval(() => {
    io.to(match.roomId).emit('COUNTDOWN', count);
    io.to(match.roomId).emit('countdown', count);  // legacy
    count--;
    if (count < 0) {
      clearInterval(interval);
      startGame(io, matchId);
    }
  }, 1000);

  broadcastQueueStatus(io);
}

function startGame(io: Server, matchId: string) {
  const match = matchManager.startGame(matchId);
  if (!match) return;

  const data = { matchId, duration: GAME_DURATION };

  // EVENT: MATCH_START → room
  io.to(match.roomId).emit('MATCH_START', data);
  io.to(match.roomId).emit('game_start', data);  // legacy

  console.log(`🎯 MATCH_START: ${matchId} | Duration: ${GAME_DURATION}ms`);

  // End game after duration
  setTimeout(() => {
    const m = matchManager.get(matchId);
    if (m && m.status === 'ACTIVE') {
      resolveMatch(io, matchId);
    }
  }, GAME_DURATION + 500);
}

async function resolveMatch(io: Server, matchId: string) {
  const match = matchManager.get(matchId);
  if (!match || match.status === 'FINISHED') return;

  const s1 = match.scores[match.p1.socketId] || 0;
  const s2 = match.scores[match.p2.socketId] || 0;

  // Anti-cheat validation
  const v1 = s1 <= MAX_TAPS ? s1 : 0;
  const v2 = s2 <= MAX_TAPS ? s2 : 0;

  if (v1 > v2) {
    await endMatch(io, matchId, match.p1, match.p2, 'win');
  } else if (v2 > v1) {
    await endMatch(io, matchId, match.p2, match.p1, 'win');
  } else {
    await endMatch(io, matchId, null, null, 'draw');
  }
}

async function endMatch(
  io: Server,
  matchId: string,
  winner: MatchPlayer | null,
  loser: MatchPlayer | null,
  reason: string
) {
  const match = matchManager.finish(matchId);
  if (!match) return;

  const prize = (ENTRY_FEE * 2) * (1 - FEE_PERCENT / 100);
  const s1 = match.scores[match.p1.socketId] || 0;
  const s2 = match.scores[match.p2.socketId] || 0;

  try {
    // Save scores to DB
    await MatchService.saveResult(matchId, match.p1.dbId, s1, { taps: match.taps[match.p1.socketId] });
    await MatchService.saveResult(matchId, match.p2.dbId, s2, { taps: match.taps[match.p2.socketId] });

    if (reason === 'draw') {
      // Refund both
      const w1 = await WalletService.refundPlayer(match.p1.dbId, matchId, 'draw');
      const w2 = await WalletService.refundPlayer(match.p2.dbId, matchId, 'draw');
      await MatchService.finishMatch(matchId, null, true);
      await MatchService.updateLeaderboard(match.p1.dbId, match.gameType, 'draw');
      await MatchService.updateLeaderboard(match.p2.dbId, match.gameType, 'draw');

      const drawData = (yours: number, opp: number, wallet: number) => ({
        result: 'draw', yourScore: yours, oppScore: opp, prize: 0, refund: ENTRY_FEE,
      });

      io.to(match.p1.socketId).emit('MATCH_RESULT', drawData(s1, s2, w1));
      io.to(match.p2.socketId).emit('MATCH_RESULT', drawData(s2, s1, w2));
      io.to(match.p1.socketId).emit('match_result', drawData(s1, s2, w1));  // legacy
      io.to(match.p2.socketId).emit('match_result', drawData(s2, s1, w2));  // legacy
      io.to(match.p1.socketId).emit('wallet_update', w1);
      io.to(match.p2.socketId).emit('wallet_update', w2);

    } else if (winner && loser) {
      const payout = await WalletService.payWinner(winner.dbId, matchId);
      const loserWallet = await WalletService.getWallet(loser.dbId);
      const loserBal = loserWallet.balance.toNumber();

      await MatchService.finishMatch(matchId, winner.dbId, false);
      await MatchService.updateLeaderboard(winner.dbId, match.gameType, 'win', payout.prize);
      await MatchService.updateLeaderboard(loser.dbId, match.gameType, 'loss');

      const winData = {
        result: 'win',
        yourScore: match.scores[winner.socketId] || 0,
        oppScore: match.scores[loser.socketId] || 0,
        prize, reason,
      };
      const loseData = {
        result: 'lose',
        yourScore: match.scores[loser.socketId] || 0,
        oppScore: match.scores[winner.socketId] || 0,
        prize: 0, reason,
      };

      io.to(winner.socketId).emit('MATCH_RESULT', winData);
      io.to(loser.socketId).emit('MATCH_RESULT', loseData);
      io.to(winner.socketId).emit('match_result', winData);  // legacy
      io.to(loser.socketId).emit('match_result', loseData);  // legacy
      io.to(winner.socketId).emit('wallet_update', payout.newBalance);
      io.to(loser.socketId).emit('wallet_update', loserBal);
    }
  } catch (err) {
    console.error('endMatch DB error:', err);
  }

  // Leave room
  const s1Socket = io.sockets.sockets.get(match.p1.socketId);
  const s2Socket = io.sockets.sockets.get(match.p2.socketId);
  if (s1Socket) s1Socket.leave(match.roomId);
  if (s2Socket) s2Socket.leave(match.roomId);

  console.log(`🏆 MATCH_RESULT: ${matchId} | ${reason === 'draw' ? 'DRAW' : `${winner?.name} wins`} | Scores: ${s1}-${s2}`);
  broadcastQueueStatus(io);
}

// ===== BROADCASTS =====
function broadcastOnline(io: Server) {
  io.emit('online_count', io.engine.clientsCount);
}

function broadcastQueueStatus(io: Server) {
  io.emit('QUEUE_STATUS', {
    waiting: queue.size(),
    matches: matchManager.stats(),
  });
}

// Export for API use
export function getSystemStats() {
  return {
    queueSize: queue.size(),
    matches: matchManager.stats(),
  };
}
