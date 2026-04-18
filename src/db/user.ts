import prisma from './prisma';

export class UserService {

  // Find or create user (used during login)
  static async findOrCreate(lineUserId: string, displayName?: string, pictureUrl?: string) {
    let user = await prisma.user.findUnique({
      where: { lineUserId },
      include: { wallet: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          lineUserId,
          displayName: displayName || `Player_${Math.floor(Math.random() * 9999)}`,
          pictureUrl,
          wallet: {
            create: { balance: 100 }, // signup bonus
          },
        },
        include: { wallet: true },
      });
      console.log(`🆕 New user: ${user.displayName} (DB ID: ${user.id})`);
    } else {
      // Update profile if changed
      if (displayName || pictureUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            displayName: displayName || user.displayName,
            pictureUrl: pictureUrl || user.pictureUrl,
          },
          include: { wallet: true },
        });
      }
    }

    return user;
  }

  // Get user by DB id
  static async getById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
  }

  // Get user by LINE userId
  static async getByLineId(lineUserId: string) {
    return prisma.user.findUnique({
      where: { lineUserId },
      include: { wallet: true },
    });
  }
}
