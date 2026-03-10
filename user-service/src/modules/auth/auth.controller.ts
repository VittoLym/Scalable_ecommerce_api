import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Get,
  HttpException,
  HttpStatus,
  HttpCode,
  UseGuards,
  Query,
  Ip,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../auth/dto/login.dto';
import { AuthGuard as AG } from './guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ForgotPasswordDto } from './dto/forgot-password';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { JwtService } from '@nestjs/jwt';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from '../user/user.service';
import { Public } from './dto/skip-roles.decorator';

@Controller('auth')
@UseGuards(AG)
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  private getLocationFromIp(ip: string): string {
    if (ip === '::1' || ip === '127.0.0.1') {
      return 'Entorno local';
    }
    if (
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.')
    ) {
      return 'Red local';
    }
    return 'Ubicación no disponible (servicio no implementado)';
  }
  @Post('login')
  @Public()
  async login(
    @Body() data: LoginUserDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    try {
      console.log('Login attempt:', { email: data.email, ip, userAgent });
      const result = await this.authService.login(data, ip, userAgent);
      console.log('Login successful:', { email: data.email });
      return {
        success: true,
        message: 'Login exitoso',
        data: result,
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Login error:', {
          email: data.email,
          error: error.message,
        });
      }

      if (error!.message == 'Credenciales inválidas') {
        throw new HttpException(
          error.message || 'Credenciales inválidas',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new HttpException(
        'Error en el servidor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Public()
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    try {
      const existingUser = await this.authService.findByEmail(
        registerDto.email,
      );
      if (existingUser) {
        throw new HttpException('El usuario ya existe', HttpStatus.CONFLICT);
      }
      const ip = req.ip || '0';
      const userAgent = req.headers['user-agent'] || 'aplication/json';
      const user = await this.authService.create(registerDto, ip, userAgent);
      return user;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al registrar el usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @Get('verify-email')
  @Public()
  async verifyEmail(@Query('token') token: string) {
    const user = await this.authService.verifyEmail(token);
    return user;
  }
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return {
      success: true,
      data: user,
    };
  }
  @Roles(Role.ADMIN)
  @Post('admin')
  admin(@Req() req: Request) {
    console.log('acá debería ir el dashboard.');
    return 'admin dashboard';
  }
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['refreshToken'] || req.body['refreshToken'];
    if (!token) throw new Error('No hay token');
    const { accessToken, refreshToken } = await this.authService.refresh(token);
    console.log(accessToken);
    console.log(refreshToken);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth/refresh',
    });
    return { accessToken };
  }
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'] as string;
    if (!refreshToken) return { ok: true };
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/auth/refresh',
    });

    return this.authService.logout(refreshToken);
  }
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    try {
      await this.authService.sendPasswordResetEmail(forgotPasswordDto.email);
      return {
        success: true,
        message:
          'Si el email existe, recibirás un enlace para restablecer tu contraseña',
      };
    } catch (error) {
      return {
        success: true,
        message:
          'Si el email existe, recibirás un enlace para restablecer tu contraseña',
      };
    }
  }
  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('password') newPassword: string,
    @Req() req,
  ) {
    const requestIp = 
      req.headers['x-forwarded-for']?.toString().split(',')[0] || 
      req.socket.remoteAddress ||
      req.ip ||
      'IP no disponible';
    const userAgent =
      (req.headers['user-agent'] as string) || 'User-Agent no disponible';
    const location = await this.getLocationFromIp(requestIp);
    const user = await this.authService.resetPassword(token, newPassword, {
      location,
      userAgent,
      requestIp });
    return user;
  }
  @Get('info')
  @HttpCode(HttpStatus.OK)
  getClientInfo(@Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      req.ip ||
      'IP no disponible';
    const userAgent = req.get('user-agent') || 'User-Agent no disponible';
    const acceptLanguage = req.get('accept-language') || 'No especificado';
    const method = req.method;
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const location = this.getLocationFromIp(ip);
    return {
      success: true,
      data: {
        ip,
        userAgent,
        acceptLanguage,
        method,
        url: fullUrl,
        timestamp: new Date().toISOString(),
        location,
      },
    };
  }
  @MessagePattern('validate_token')
  async validateToken(@Payload() data: { token: string }) {
    try {
      const decoded = this.jwtService.verify(data.token);
      const user = await this.userService.findById(decoded.sub);
      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          roles: user.roles || [user.role],
        },
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
