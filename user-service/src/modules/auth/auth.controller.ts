import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { Response, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../auth/dto/login.dto';
import { UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() data: LoginUserDto) {
    return this.authService.login(data);
  }
  @Get('me')
  @Post('register')
  regisrter(@CurrentUser() user: any, @Body() data: RegisterDto) {
    console.log(data, user);
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
}
