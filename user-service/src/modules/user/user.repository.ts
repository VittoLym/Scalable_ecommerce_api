import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findByIdWithRelations(id: string) {
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

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async incrementLoginAttempts(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        loginAttempts: { increment: 1 },
      },
    });
  }

  async resetLoginAttempts(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
      },
    });
  }
}
