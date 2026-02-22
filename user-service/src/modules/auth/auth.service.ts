import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginUserDto } from '../auth/dto/login.dto';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}
  private users = [];
  async findByEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    return user;
  }

  async create(userData: any) {
    const newUser = {
      id: Date.now(),
      ...userData,
      createdAt: new Date(),
    };
    const user = await this.prisma.user.create(newUser);
    return newUser;
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async validateUser(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
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
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }
    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const jti = randomUUID();
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
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
        accessJti: jti,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        ipAddress: ip,
        userAgent,
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
  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiresAt: null,
      },
    });

    return { message: 'Email verified successfully' };
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
    return this.jwtService.sign({
      payload,
      options: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      },
    });
  }
  private generateRefreshToken(payload: object) {
    return this.jwtService.sign({
      payload: { ...payload, tokenType: 'refresh' },
      options: {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
    });
  }
  async sendPasswordResetEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const token = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          type: 'password-reset',
        },
        { expiresIn: '1h' },
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpiresAt: new Date(Date.now() + 3600000), // 1 hora
        },
      });
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
//      await this.mailerService.sendMail({
//        to: user.email,
//        subject: 'Restablecer tu contraseña',
//        template: './forgot-password', // puedes crear un template
//        context: {
//          name: user.name || user.email,
//          resetUrl,
//        },
//      });
    }
  }
  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
    await this.prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password updated successfully' };
  }
}
