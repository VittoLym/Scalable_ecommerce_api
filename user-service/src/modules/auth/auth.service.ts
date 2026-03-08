import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  HttpException,
  InternalServerErrorException,
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
import { profile } from 'console';

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
    const decoded = this.jwtService.decode(oldRefreshToken);
    console.log('📦 Token decodificado (sin verificar):', decoded);
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (error) {
      console.error('❌ Error en refresh:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Refresh token expirado');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Refresh token inválido');
      }
      throw error;
    }
    const tokens = await this.prisma.userSession.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
      },
    });
    for (const stored of tokens) {
      const match = await bcrypt.compare(oldRefreshToken, stored.refreshToken);
      if (!match) continue;
      const user = await this.prisma.user.findFirst({
        where: {
          id: stored.userId,
        },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const session = await this.prisma.userSession.findFirst({
        where: {
          userId: stored.userId,
        },
      });
      const pl = {
        sub: user.id,
        email: user.email,
        role: user.role,
        jti: session?.accessJti,
      };
      const newAccessToken = this.generateAccessToken(pl);
      const newRefreshToken = this.generateRefreshToken(pl);
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
        status: 'ACTIVE',
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
  private generateAccessToken(payload: any) {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' as any,
    });
  }
  private generateRefreshToken(payload: any) {
    console.log('🔍 generateRefreshToken - payload recibido:', payload);
    const token = this.jwtService.sign(
      { ...payload, tokenType: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' as any,
      },
    );
    const decoded = this.jwtService.decode(token);
    console.log(
      '🔍 generateRefreshToken - token generado (decodificado):',
      decoded,
    );
    return token;
  }
  async sendPasswordResetEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
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
      await this.emailService.sendPasswordResetEmail(
        email,
        token,
        user.profile?.fullName || 'unknow',
      );
    }
  }
  async resetPassword(
    token: string,
    newPassword: string,
    metadata: { requestIp?: string; userAgent?: string; location?: string },
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('🔄 Procesando reset de contraseña');
      let payload: any;
      try {
        payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
        });
      } catch (error) {
        this.logger.error('❌ Token inválido o expirado:', error.message);
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedException(
            'El enlace de recuperación ha expirado. Solicita uno nuevo.',
          );
        }
        throw new UnauthorizedException(
          'El enlace de recuperación no es válido.',
        );
      }
      if (payload.type !== 'password-reset') {
        this.logger.error('❌ Tipo de token incorrecto:', payload.type);
        throw new UnauthorizedException(
          'El enlace de recuperación no es válido.',
        );
      }
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          passwordResetToken: token,
          passwordResetExpiresAt: {
            gt: new Date(),
          },
        },
        include: {
          profile: true,
        },
      });
      if (!user) {
        this.logger.error('❌ Usuario no encontrado o token ya utilizado');
        throw new UnauthorizedException(
          'El enlace de recuperación ya fue utilizado o es inválido.',
        );
      }
      if (!newPassword || newPassword.length < 8) {
        throw new BadRequestException(
          'La contraseña debe tener al menos 8 caracteres',
        );
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
      if (!passwordRegex.test(newPassword)) {
        throw new BadRequestException(
          'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
        );
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpiresAt: null,
          },
        });
        await tx.userSession.updateMany({
          where: {
            userId: user.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'PASSWORD_RESET_SUCCESS',
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
        });
      });
      this.logger.log(
        `✅ Contraseña restablecida exitosamente para usuario: ${user.id}`,
      );
      try {
        await this.emailService.sendPasswordChangedEmail(
          user.email,
          user.profile?.fullName || 'unknow',
          {
            ip: metadata.requestIp || 'local',
            device: metadata.userAgent || 'userAgent',
            location: metadata.location || 'Argentina',
          },
        );
      } catch (mailError) {
        this.logger.error('Error enviando email de confirmación:', mailError);
      }
      return {
        success: true,
        message:
          'Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
      };
    } catch (error) {
      this.logger.error(
        `❌ Error en resetPassword: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al procesar la solicitud. Por favor intenta nuevamente.',
      );
    }
  }
}
