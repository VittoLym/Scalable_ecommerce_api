import { PrismaService } from '../../prisma/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';
import { RegisterUserDto } from './dto/user-register.dto';
import { AuthProvider, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
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
  async checkDatabaseConnection(): Promise<boolean> {
    if (!this.prisma) {
      console.error('Prisma is undefined in checkDatabaseConnection');
      throw new Error('Prisma service not initialized');
    }
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Database connection failed');
    }
  }
  async findByIds(userIds: string[]) {
    this.logger.log(`🔍 Buscando ${userIds.length} usuarios por IDs`);
    try {
      if (!userIds || userIds.length === 0) {
        return [];
      }
      const users = await this.prisma.user.findMany({
        where: {
          id: {
            in: userIds, // Buscar todos los IDs en una sola consulta
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      this.logger.log(
        `✅ Encontrados ${users.length} usuarios de ${userIds.length} solicitados`
      );
      const foundIds = users.map((u) => u.id);
      const missingIds = userIds.filter((id) => !foundIds.includes(id));
      if (missingIds.length > 0) {
        this.logger.warn(
          `⚠️ Usuarios no encontrados: ${missingIds.join(', ')}`,
        );
      }

      return users;
    } catch (error) {
      this.logger.error(
        `❌ Error buscando usuarios por IDs: ${error.message}`,
        error.stack
      );
      throw new Error(`Error al buscar usuarios: ${error.message}`);
    }
  }
  async findByIdsPaginated(
    userIds: string[],
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          role: true,
        },
      }),
      this.prisma.user.count({
        where: {
          id: { in: userIds },
        },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  async findByIdWithRelations(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        profile: true, // Si tienes perfil relacionado
      },
    });
  }
}
