import { PrismaService } from "./prisma/prisma.service";
export class UserRepository {
  constructor(private prisma: PrismaService) {}
  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        profile: true,
        addresses: {
          where: { deletedAt: null },
        },
        paymentMethods: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async create(data: any) {
    return this.prisma.user.create({
      data,
      include: {
        profile: true,
      },
    });
  }

  async incrementLoginAttempts(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: { increment: 1 }
      }
    })
  }

  async resetLoginAttempts(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null
      }
    })
  }
}
