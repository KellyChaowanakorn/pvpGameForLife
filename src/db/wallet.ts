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
}

export { ENTRY_FEE, FEE_PERCENT };
