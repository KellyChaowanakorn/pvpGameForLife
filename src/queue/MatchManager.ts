import { GamePlugin } from '../games/GamePlugin';

export type MatchStatus = 'COUNTDOWN' | 'ACTIVE' | 'FINISHED';

export interface MatchPlayer {
  socketId: string;
  dbId: number;
  name: string;
  wallet: number;
}

export interface ActiveMatch {
  id: string;
  gameType: string;       // e.g. 'target_tap', 'combo_tap', 'endurance'
  status: MatchStatus;
  p1: MatchPlayer;
  p2: MatchPlayer;
  roomId: string;
  game: GamePlugin;       // game logic handler
  startedAt: number | null;
  createdAt: number;
}

export class MatchManager {
  private matches: Record<string, ActiveMatch> = {};
  private playerMatch: Record<string, string> = {};

  create(matchId: string, gameType: string, p1: MatchPlayer, p2: MatchPlayer, game: GamePlugin): ActiveMatch {
    const roomId = `match:${matchId}`;
    const match: ActiveMatch = {
      id: matchId, gameType, status: 'COUNTDOWN',
      p1, p2, roomId, game,
      startedAt: null, createdAt: Date.now(),
    };
    this.matches[matchId] = match;
    this.playerMatch[p1.socketId] = matchId;
    this.playerMatch[p2.socketId] = matchId;
    console.log(`🎮 Match created: ${matchId} | ${p1.name} vs ${p2.name} | Mode: ${gameType}`);
    return match;
  }

  startGame(matchId: string): ActiveMatch | null {
    const match = this.matches[matchId];
    if (!match || match.status !== 'COUNTDOWN') return null;
    match.status = 'ACTIVE';
    match.startedAt = Date.now();
    console.log(`▶️ Match ${matchId} → ACTIVE`);
    return match;
  }

  processInput(matchId: string, socketId: string, input: any): number | null {
    const match = this.matches[matchId];
    if (!match || match.status !== 'ACTIVE') return null;
    return match.game.processInput(socketId, input);
  }

  getScore(matchId: string, socketId: string): number {
    const match = this.matches[matchId];
    if (!match) return 0;
    return match.game.getScore(socketId);
  }

  finish(matchId: string): ActiveMatch | null {
    const match = this.matches[matchId];
    if (!match || match.status === 'FINISHED') return null;
    match.status = 'FINISHED';
    delete this.playerMatch[match.p1.socketId];
    delete this.playerMatch[match.p2.socketId];
    console.log(`🏁 Match ${matchId} → FINISHED`);
    setTimeout(() => delete this.matches[matchId], 30000);
    return match;
  }

  get(matchId: string): ActiveMatch | null { return this.matches[matchId] || null; }
  getByPlayer(socketId: string): ActiveMatch | null {
    const id = this.playerMatch[socketId];
    return id ? this.matches[id] || null : null;
  }
  isPlayerBusy(socketId: string): boolean { return !!this.playerMatch[socketId]; }
  getOpponentSocketId(matchId: string, mySocketId: string): string | null {
    const m = this.matches[matchId];
    if (!m) return null;
    return m.p1.socketId === mySocketId ? m.p2.socketId : m.p1.socketId;
  }
  stats() {
    const all = Object.values(this.matches);
    return {
      total: all.length,
      countdown: all.filter(m => m.status === 'COUNTDOWN').length,
      active: all.filter(m => m.status === 'ACTIVE').length,
      finished: all.filter(m => m.status === 'FINISHED').length,
    };
  }
}
