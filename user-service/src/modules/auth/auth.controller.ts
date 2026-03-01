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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';
import { ForgotPasswordDto } from './dto/forgot-password';
import { UserResponseDto } from '../user/dto/user-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
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

      if (error instanceof UnauthorizedException) {
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
  async verifyEmail(@Query('token') token: string) {
    const user = await this.authService.verifyEmail(token);
    return user;
  }
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@CurrentUser() user: any) {
    return {
      success: true,
      data: user,
    };
  }
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @Post('admin')
  admin() {
    console.log('acá debería ir el dashboard.');
  }
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['refreshToken'];
    if (!token) throw new Error('No hay token');
    const { accessToken, refreshToken } = await this.authService.refresh(token);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth/refresh',
    });
    return { accessToken };
  }
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('password') newPassword: string,
  ) {
    const user = await this.authService.resetPassword(token, newPassword);
    return user;
  }
}
