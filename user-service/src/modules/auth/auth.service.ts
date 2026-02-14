import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginUserDto } from '../auth/dto/login.dto';
import bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(data: LoginUserDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: data.email,
        deletedAt: null,
      },
    });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken: string = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: hashedRefresh,
        token: accessToken,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return {
      accessToken,
      refreshToken,
    };
  }
  async refresh(oldRefreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokens = await this.prisma.userSession.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
      },
    });
    for (const stored of tokens) {
      const match = await bcrypt.compare(oldRefreshToken, stored.token);
      if (!match) continue;
      const user = await this.prisma.user.findFirst({
        where: {
          id: stored.userId,
        },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);
      await this.prisma.userSession.update({
        where: {
          id: stored.id,
        },
        data: {
          token: await bcrypt.hash(newRefreshToken, 10),
          userId: user.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
      });
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    }
    throw new UnauthorizedException();
  }
  async logout(refreshToken: string) {
    const tokens = await this.prisma.userSession.findMany();
    for (const stored of tokens) {
      const match = await bcrypt.compare(refreshToken, stored.token);
      if (!match) continue;
      const user = stored.id;
      await this.prisma.userSession.updateMany({
        where: {
          id: user,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }
  }
  private generateAccessToken(payload: object) {
    return this.jwt.sign({
      payload,
      options: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      },
    });
  }
  private generateRefreshToken(payload: object) {
    return this.jwt.sign({
      payload: { ...payload, tokenType: 'refresh' },
      options: {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
    });
  }
}
