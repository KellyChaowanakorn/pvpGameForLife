import prisma from './prisma';
import { ENTRY_FEE, FEE_PERCENT } from './wallet';

export class MatchService {

  // Create match record
  static async createMatch(matchId: string, gameType: string, player1Id: number, player2Id: number) {
    const prizePool = ENTRY_FEE * 2;
    const platformFee = prizePool * (FEE_PERCENT / 100);

    return prisma.match.create({
      data: {
        id: matchId,
        gameType,
        player1Id,
        player2Id,
        entryFee: ENTRY_FEE,
        prizePool,
        platformFee,
        status: 'playing',
        startedAt: new Date(),
      },
    });
  }

  // Finish match
  static async finishMatch(matchId: string, winnerId: number | null, isDraw: boolean) {
    return prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'finished',
        winnerId,
        isDraw,
        finishedAt: new Date(),
      },
    });
  }

  // Cancel match
  static async cancelMatch(matchId: string) {
    return prisma.match.update({
      where: { id: matchId },
      data: { status: 'cancelled', finishedAt: new Date() },
    });
  }

  // Save game result (score)
  static async saveResult(matchId: string, userId: number, score: number, playData?: any) {
    return prisma.gameResult.create({
      data: {
        matchId,
        userId,
        score,
        playData: playData || undefined,
        isValid: true,
      },
    });
  }

  // Get match history for user
  static async getHistory(userId: number, limit: number = 20) {
    return prisma.match.findMany({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        status: 'finished',
      },
      include: {
        player1: { select: { displayName: true, pictureUrl: true } },
        player2: { select: { displayName: true, pictureUrl: true } },
        winner: { select: { displayName: true } },
        gameResults: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Update leaderboard
  static async updateLeaderboard(userId: number, gameType: string, outcome: 'win' | 'loss' | 'draw', earned: number = 0) {
    const existing = await prisma.leaderboard.findUnique({
      where: { userId_gameType: { userId, gameType } },
    });

    if (!existing) {
      return prisma.leaderboard.create({
        data: {
          userId,
          gameType,
          totalWins: outcome === 'win' ? 1 : 0,
          totalLoss: outcome === 'loss' ? 1 : 0,
          totalDraws: outcome === 'draw' ? 1 : 0,
          totalEarned: earned,
          winStreak: outcome === 'win' ? 1 : 0,
          bestStreak: outcome === 'win' ? 1 : 0,
        },
      });
    }

    const winStreak = outcome === 'win' ? existing.winStreak + 1 : 0;
    const bestStreak = Math.max(existing.bestStreak, winStreak);

    return prisma.leaderboard.update({
      where: { userId_gameType: { userId, gameType } },
      data: {
        totalWins: { increment: outcome === 'win' ? 1 : 0 },
        totalLoss: { increment: outcome === 'loss' ? 1 : 0 },
        totalDraws: { increment: outcome === 'draw' ? 1 : 0 },
        totalEarned: { increment: earned },
        winStreak,
        bestStreak,
      },
    });
  }

  // Get leaderboard
  static async getLeaderboard(gameType: string, limit: number = 50) {
    return prisma.leaderboard.findMany({
      where: { gameType },
      include: {
        user: { select: { displayName: true, pictureUrl: true } },
      },
      orderBy: [{ totalWins: 'desc' }, { totalEarned: 'desc' }],
      take: limit,
    });
  }
}
