import prisma from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

const ENTRY_FEE = parseFloat(process.env.ENTRY_FEE || '5');
const FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5');

export class WalletService {

  // Get or create wallet for user
  static async getWallet(userId: number) {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId, balance: 100 }, // 100 baht signup bonus
      });
    }
    return wallet;
  }

  // Check balance
  static async hasBalance(userId: number, amount: number = ENTRY_FEE): Promise<boolean> {
    const wallet = await this.getWallet(userId);
    return wallet.balance.toNumber() >= amount;
  }

  // Deduct entry fee (atomic transaction)
  static async deductEntryFee(userId: number, matchId: string): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('Wallet not found');

      const balance = wallet.balance.toNumber();
      if (balance < ENTRY_FEE) throw new Error('Insufficient balance');

      const newBalance = balance - ENTRY_FEE;

      await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'entry_fee',
          amount: -ENTRY_FEE,
          balanceBefore: balance,
          balanceAfter: newBalance,
          referenceId: matchId,
          description: `Entry fee for match`,
        },
      });

      return newBalance;
    });
  }

  // Pay winner
  static async payWinner(userId: number, matchId: string): Promise<{ prize: number; newBalance: number }> {
    const prizePool = ENTRY_FEE * 2;
    const platformFee = prizePool * (FEE_PERCENT / 100);
    const prize = prizePool - platformFee;

    const newBalance = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('Wallet not found');

      const balance = wallet.balance.toNumber();
      const updated = balance + prize;

      await tx.wallet.update({
        where: { userId },
        data: { balance: updated },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'prize',
          amount: prize,
          balanceBefore: balance,
          balanceAfter: updated,
          referenceId: matchId,
          description: `Won match! Prize: ฿${prize}`,
        },
      });

      return updated;
    });

    return { prize, newBalance };
  }

  // Refund player
  static async refundPlayer(userId: number, matchId: string, reason: string = 'draw'): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('Wallet not found');

      const balance = wallet.balance.toNumber();
      const newBalance = balance + ENTRY_FEE;

      await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'refund',
          amount: ENTRY_FEE,
          balanceBefore: balance,
          balanceAfter: newBalance,
          referenceId: matchId,
          description: `Refund: ${reason}`,
        },
      });

      return newBalance;
    });
  }

  // Deposit
  static async deposit(userId: number, amount: number): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('Wallet not found');

      const balance = wallet.balance.toNumber();
      const newBalance = balance + amount;

      await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'deposit',
          amount,
          balanceBefore: balance,
          balanceAfter: newBalance,
          description: `Deposit ฿${amount}`,
        },
      });

      return newBalance;
    });
  }

  // === DEPOSIT REQUEST (pending → admin approve) ===
  static async createDepositRequest(userId: number, amount: number, method: string = 'promptpay') {
    return prisma.depositRequest.create({
      data: { userId, amount, method, status: 'pending' },
    });
  }

  static async approveDeposit(requestId: number) {
    return prisma.$transaction(async (tx) => {
      const req = await tx.depositRequest.findUnique({ where: { id: requestId } });
      if (!req || req.status !== 'pending') throw new Error('Invalid request');

      const wallet = await tx.wallet.findUnique({ where: { userId: req.userId } });
      if (!wallet) throw new Error('Wallet not found');

      const balance = wallet.balance.toNumber();
      const amount = req.amount.toNumber();
      const newBalance = balance + amount;

      await tx.wallet.update({ where: { userId: req.userId }, data: { balance: newBalance } });
      await tx.transaction.create({
        data: { walletId: wallet.id, type: 'deposit', amount, balanceBefore: balance, balanceAfter: newBalance, referenceId: `DEP-${requestId}`, description: `Deposit ฿${amount} approved` },
      });
      await tx.depositRequest.update({ where: { id: requestId }, data: { status: 'approved', processedAt: new Date() } });

      return newBalance;
    });
  }

  static async rejectDeposit(requestId: number, note: string = '') {
    return prisma.depositRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', adminNote: note, processedAt: new Date() },
    });
  }

  // === WITHDRAW REQUEST ===
  static async createWithdrawRequest(userId: number, amount: number, promptpayId?: string, bankAccount?: string, bankName?: string) {
    // Check balance
    const wallet = await this.getWallet(userId);
    const balance = wallet.balance.toNumber();
    if (balance < amount) throw new Error('Insufficient balance');
    if (amount < 20) throw new Error('Minimum withdraw is ฿20');

    // Lock balance immediately
    return prisma.$transaction(async (tx) => {
      const w = await tx.wallet.findUnique({ where: { userId } });
      if (!w || w.balance.toNumber() < amount) throw new Error('Insufficient balance');

      const newBalance = w.balance.toNumber() - amount;
      await tx.wallet.update({ where: { userId }, data: { balance: newBalance } });
      await tx.transaction.create({
        data: { walletId: w.id, type: 'withdraw', amount: -amount, balanceBefore: w.balance.toNumber(), balanceAfter: newBalance, description: `Withdraw request ฿${amount}` },
      });

      return tx.withdrawRequest.create({
        data: { userId, amount, status: 'pending', promptpayId, bankAccount, bankName },
      });
    });
  }

  static async approveWithdraw(requestId: number) {
    return prisma.withdrawRequest.update({
      where: { id: requestId },
      data: { status: 'approved', processedAt: new Date() },
    });
  }

  static async rejectWithdraw(requestId: number, note: string = '') {
    // Refund balance
    return prisma.$transaction(async (tx) => {
      const req = await tx.withdrawRequest.findUnique({ where: { id: requestId } });
      if (!req || req.status !== 'pending') throw new Error('Invalid request');

      const wallet = await tx.wallet.findUnique({ where: { userId: req.userId } });
      if (!wallet) throw new Error('Wallet not found');

      const balance = wallet.balance.toNumber();
      const amount = req.amount.toNumber();
      const newBalance = balance + amount;

      await tx.wallet.update({ where: { userId: req.userId }, data: { balance: newBalance } });
      await tx.transaction.create({
        data: { walletId: wallet.id, type: 'refund', amount, balanceBefore: balance, balanceAfter: newBalance, referenceId: `WD-${requestId}`, description: `Withdraw rejected - refunded ฿${amount}` },
      });
      await tx.withdrawRequest.update({ where: { id: requestId }, data: { status: 'rejected', adminNote: note, processedAt: new Date() } });

      return newBalance;
    });
  }

  // === TRANSACTION HISTORY ===
  static async getTransactions(userId: number, limit: number = 50) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return [];
    return prisma.transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // === PLATFORM EARNINGS ===
  static async recordPlatformFee(matchId: string, amount: number) {
    return prisma.platformEarning.create({
      data: { matchId, amount },
    });
  }

  static async getPlatformEarnings(days: number = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const earnings = await prisma.platformEarning.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
    const total = earnings.reduce((s, e) => s + e.amount.toNumber(), 0);
    return { total, count: earnings.length, earnings };
  }

  // === ADMIN STATS ===
  static async getAdminStats() {
    const totalUsers = await prisma.user.count();
    const totalDeposits = await prisma.depositRequest.count({ where: { status: 'approved' } });
    const pendingDeposits = await prisma.depositRequest.count({ where: { status: 'pending' } });
    const pendingWithdraws = await prisma.withdrawRequest.count({ where: { status: 'pending' } });
    const totalMatches = await prisma.match.count({ where: { status: 'finished' } });

    const earnings = await prisma.platformEarning.aggregate({ _sum: { amount: true } });

    return {
      totalUsers, totalDeposits, pendingDeposits, pendingWithdraws, totalMatches,
      totalEarnings: earnings._sum.amount?.toNumber() || 0,
    };
  }
}

export { ENTRY_FEE, FEE_PERCENT };
