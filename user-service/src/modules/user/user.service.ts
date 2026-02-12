import { PrismaService } from '../../prisma/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';
import { RegisterUserDto } from './dto/user-register.dto';
import { Prisma, AuthProvider, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';

export class UserService {
  constructor(private prisma: PrismaService) {}
  private toResponse(user: any): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async register(data: RegisterUserDto, ip?: string, userAgent?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: data.email,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    let hashedPassword: string | null = null;

    if ((data.authProvider ?? AuthProvider.LOCAL) === AuthProvider.LOCAL) {
      if (!data.password) {
        throw new Error('Password is required');
      }
      hashedPassword = await bcrypt.hash(data.password, 10);
      console.log(hashedPassword);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          authProvider: data.authProvider ?? AuthProvider.LOCAL,
          role: data.role ?? Role.USER,
          profile: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName,
              fullName: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
            },
          },
        },
        include: {
          profile: true,
        },
      });

      await tx.userAuditLog.create({
        data: {
          userId: createdUser.id,
          action: 'REGISTER',
          ipAddress: ip,
          userAgent,
        },
      });

      return createdUser;
    });

    return this.toResponse(user);
  }

  async findById(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
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

    if (!user) {
      throw new Error('User not found');
    }

    return this.toSafeUser(user)
  }

  async softDelete(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });

      await tx.userSession.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      });

      await tx.userAuditLog.create({
        data: {
          userId,
          action: 'SOFT_DELETE',
        },
      });
    });

    return { success: true };
  }

  private toSafeUser(user: any) {
    const { password, ...safeUser } = user
    return safeUser
  }
  getHello() {
    return 'helllo';
  }
}
