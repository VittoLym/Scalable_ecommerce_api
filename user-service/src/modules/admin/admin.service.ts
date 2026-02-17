import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}
  async getUserSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }
  async revokeSession(sessionId: string) {
    const session = await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    if (session.accessJti) {
      await this.redisService.blacklistToken(session.accessJti, 900); // 15 min
    }
    return session;
  }
  async revokeAllSessions(userId: string) {
    return this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
