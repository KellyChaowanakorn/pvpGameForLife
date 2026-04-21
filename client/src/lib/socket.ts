import { io, Socket } from 'socket.io-client';
import { useGameStore } from './store';
import { playCountdown, playGo, playWin, playLose, unlockAudio } from './sounds';

const URL = import.meta.env.DEV ? 'http://localhost:3000' : '';
export const socket: Socket = io(URL, { autoConnect: false });

export function initSocket() {
  const store = useGameStore.getState();
  socket.connect();

  if (store.token) {
    socket.emit('set_name', { token: store.token, name: store.playerName });
  } else {
    socket.emit('set_name', store.playerName);
  }

  socket.on('wallet_update', (val: number) => {
    useGameStore.getState().setWallet(val);
  });

  socket.on('online_count', (n: number) => {
    useGameStore.getState().setOnlineCount(n);
  });

  socket.on('queued', () => {
    useGameStore.getState().setScreen('queue');
  });

  socket.on('queue_cancelled', () => {
    useGameStore.getState().setScreen('lobby');
  });

  socket.on('queue_timeout', () => {
    useGameStore.getState().setScreen('lobby');
  });

  socket.on('error_msg', (msg: string) => {
    alert(msg);
  });

  socket.on('match_found', (data: any) => {
    const s = useGameStore.getState();
    s.setMatch(data.matchId, data.opponent, data.prize);
    if (data.gameConfig) s.setGameConfig(data.gameConfig);
    if (data.gameType) s.setGameMode(data.gameType);
    s.setScreen('vs');
  });

  socket.on('countdown', (n: number) => {
    const s = useGameStore.getState();
    s.setCountdown(n);
    s.setScreen('countdown');
    if (n > 0) playCountdown();
    else playGo();
    if (navigator.vibrate) navigator.vibrate(30);
  });

  socket.on('game_start', (data: any) => {
    const s = useGameStore.getState();
    s.resetGame();
    s.setMatch(data.matchId, s.opponentName, s.prize);
    s.setScreen('game');

    const start = Date.now();
    const dur = data.duration || 10000;
    const interval = setInterval(() => {
      const left = Math.max(0, (dur - (Date.now() - start)) / 1000);
      useGameStore.getState().setTimeLeft(left);
      if (left <= 0) clearInterval(interval);
    }, 50);
  });

  socket.on('your_score', (s: number) => {
    useGameStore.getState().setMyScore(s);
  });

  socket.on('opponent_tap', (s: number) => {
    useGameStore.getState().setOppScore(s);
  });

  socket.on('match_result', (data: any) => {
    const s = useGameStore.getState();
    s.setResult(data.result, data);
    if (data.result === 'win') playWin();
    else playLose();
    if (navigator.vibrate) navigator.vibrate(data.result === 'win' ? [50, 50, 50] : [100]);
    setTimeout(() => s.setScreen('result'), 600);
  });
}

export function findMatch(gameType: string) {
  unlockAudio();
  socket.emit('find_match', gameType);
}

export function cancelQueue() {
  socket.emit('cancel_queue');
}

export function sendGameInput(matchId: string, type: string, data?: any) {
  const startedAt = Date.now(); // approximate
  socket.emit('GAME_INPUT', { matchId, type, time: Date.now(), data });
}

// Legacy tap (fallback)
export function sendTap() {
  const matchId = useGameStore.getState().matchId;
  if (matchId) socket.emit('tap', matchId);
  if (navigator.vibrate) navigator.vibrate(8);
}
