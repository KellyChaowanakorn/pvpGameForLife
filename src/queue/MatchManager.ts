export type MatchStatus = 'QUEUED' | 'COUNTDOWN' | 'ACTIVE' | 'FINISHED';

export interface MatchPlayer {
  socketId: string;
  dbId: number;
  name: string;
  wallet: number;
}

export interface ActiveMatch {
  id: string;
  gameType: string;
  status: MatchStatus;
  p1: MatchPlayer;
  p2: MatchPlayer;
  scores: Record<string, number>;    // socketId -> score
  taps: Record<string, number[]>;    // socketId -> timestamps (anti-cheat)
  roomId: string;                     // Socket.IO room
  startedAt: number | null;
  createdAt: number;
}

export class MatchManager {
  private matches: Record<string, ActiveMatch> = {};
  private playerMatch: Record<string, string> = {};  // socketId -> matchId

  // Create a new match
  create(matchId: string, gameType: string, p1: MatchPlayer, p2: MatchPlayer): ActiveMatch {
    const roomId = `match:${matchId}`;

    const match: ActiveMatch = {
      id: matchId,
      gameType,
      status: 'COUNTDOWN',
      p1, p2,
      scores: { [p1.socketId]: 0, [p2.socketId]: 0 },
      taps: { [p1.socketId]: [], [p2.socketId]: [] },
      roomId,
      startedAt: null,
      createdAt: Date.now(),
    };

    this.matches[matchId] = match;
    this.playerMatch[p1.socketId] = matchId;
    this.playerMatch[p2.socketId] = matchId;

    console.log(`🎮 Match created: ${matchId} | ${p1.name} vs ${p2.name} | Status: COUNTDOWN`);
    return match;
  }

  // Transition to ACTIVE
  startGame(matchId: string): ActiveMatch | null {
    const match = this.matches[matchId];
    if (!match || match.status !== 'COUNTDOWN') return null;

    match.status = 'ACTIVE';
    match.startedAt = Date.now();

    console.log(`▶️ Match ${matchId} → ACTIVE`);
    return match;
  }

  // Record a tap
  addTap(matchId: string, socketId: string): number | null {
    const match = this.matches[matchId];
    if (!match || match.status !== 'ACTIVE') return null;
    if (match.scores[socketId] === undefined) return null;

    match.scores[socketId]++;
    match.taps[socketId].push(Date.now());

    return match.scores[socketId];
  }

  // Transition to FINISHED
  finish(matchId: string): ActiveMatch | null {
    const match = this.matches[matchId];
    if (!match || match.status === 'FINISHED') return null;

    match.status = 'FINISHED';

    // Cleanup player mapping
    delete this.playerMatch[match.p1.socketId];
    delete this.playerMatch[match.p2.socketId];

    console.log(`🏁 Match ${matchId} → FINISHED`);

    // Auto-delete after 30s
    setTimeout(() => delete this.matches[matchId], 30000);
    return match;
  }

  // Get match by ID
  get(matchId: string): ActiveMatch | null {
    return this.matches[matchId] || null;
  }

  // Get match by player socketId
  getByPlayer(socketId: string): ActiveMatch | null {
    const matchId = this.playerMatch[socketId];
    return matchId ? this.matches[matchId] || null : null;
  }

  // Check if player is in a match
  isPlayerBusy(socketId: string): boolean {
    return !!this.playerMatch[socketId];
  }

  // Get opponent socketId
  getOpponentSocketId(matchId: string, mySocketId: string): string | null {
    const match = this.matches[matchId];
    if (!match) return null;
    return match.p1.socketId === mySocketId ? match.p2.socketId : match.p1.socketId;
  }

  // Get all active match count
  activeCount(): number {
    return Object.values(this.matches).filter((m) => m.status === 'ACTIVE').length;
  }

  // Stats
  stats() {
    const all = Object.values(this.matches);
    return {
      total: all.length,
      countdown: all.filter((m) => m.status === 'COUNTDOWN').length,
      active: all.filter((m) => m.status === 'ACTIVE').length,
      finished: all.filter((m) => m.status === 'FINISHED').length,
    };
  }
}
