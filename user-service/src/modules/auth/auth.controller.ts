import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
  Query,
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

@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() data: LoginUserDto) {
    return this.authService.login(data);
  }
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      const existingUser = await this.authService.findByEmail(
        registerDto.email,
      );
      if (existingUser) {
        throw new HttpException('El usuario ya existe', HttpStatus.CONFLICT);
      }
      const verificationToken = randomBytes(32).toString('hex');
      const hashedPassword = await this.authService.hashPassword(
        registerDto.password,
      );
      const newUser = await this.authService.create({
        ...registerDto,
        password: hashedPassword,
        verificationToken,
        verificationExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      const { password, ...result } = newUser;
      return {
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result,
      };
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
  @Roles(Role.ADMIN)
  @Post('admin')
  admin() {
    console.log('acá debería ir el dashboard.');
  }
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
  ) {
    const user = await  this.authService.resetPassword(token, newPassword);
    return user;
  }
}
