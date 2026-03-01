import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginUserDto } from '../auth/dto/login.dto';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  InvalidCredentialsException,
  EmailNotVerifiedException,
  UserAlreadyExistsException,
  UserNotFoundException,
  TokenBlacklistedException,
  InvalidTokenException,
  DatabaseException,
} from '../../common/exceptions/custom-exception';
import { AuthProvider, Role } from '@prisma/client';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { plainToInstance } from 'class-transformer';
import { EmailService } from 'src/email/email.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
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
  private toResponse(user: any): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
  async create(userData: any, ip: string, userAgent?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: userData.email,
        deletedAt: null,
      },
    });
    if (existingUser) {
      throw new Error('User already exists');
    }
    let hashedPassword: string | null = null;
    if ((userData.authProvider ?? AuthProvider.LOCAL) === AuthProvider.LOCAL) {
      if (!userData.password) {
        throw new Error('Password is required');
      }
      hashedPassword = await bcrypt.hash(userData.password, 10);
    }
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          authProvider: userData.authProvider ?? AuthProvider.LOCAL,
          role: userData.role ?? Role.USER,
          emailVerified: false,
          verificationToken,
          verificationExpiresAt,
          profile: {
            create: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              fullName:
                `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim(),
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
    await this.emailService.sendVerificationEmail(
      userData.email,
      verificationToken,
      `${userData.firstName} ${userData.lastName}`.trim() || 'usuario',
    );
    return this.toResponse(user);
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
    try {
      this.logger.log(`Intento de login para email: ${data.email}`);
      const user = await this.prisma.user.findFirst({
        where: {
          email: data.email,
          deletedAt: null,
        },
      });
      if (!user || !user.password) {
        throw new InvalidCredentialsException({ email: data.email });
      }
      if (!user.emailVerified) {
        throw new EmailNotVerifiedException({ email: data.email });
      }
      const isValid = await bcrypt.compare(data.password, user.password);
      if (!isValid) {
        throw new InvalidCredentialsException({ email: data.email });
      }
      if (!user.emailVerified) {
        throw new UnauthorizedException(
          'Por favor verifica tu email antes de iniciar sesión',
        );
      }
      const jti = randomUUID();
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        jti,
      };
      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload),
        this.jwtService.signAsync(payload, {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '7d',
        }),
      ]);
      const hashedRefresh = await bcrypt.hash(refreshToken, 10);
      await this.prisma.$transaction(async (tx) => {
        await tx.userSession.create({
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
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN_SUCCESS',
            ipAddress: ip,
            userAgent,
          },
        });
      });
      this.logger.log(`Login exitoso para usuario: ${user.id}`);
      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error(`Error en login: ${error.message}`, error.stack);
      if (
        error instanceof InvalidCredentialsException ||
        error instanceof EmailNotVerifiedException
      ) {
        throw error;
      }
      throw new DatabaseException('Error al procesar el login', {
        originalError: error.message 
      });
    }
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
