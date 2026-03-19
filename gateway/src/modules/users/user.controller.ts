import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { proxyRequest } from '../../common/interceptors/proxy.interceptor';

@Controller('users')
export class UsersController {
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req) {
    return proxyRequest(
      'GET',
      `${process.env.USER_SERVICE_URL}/users/me`,
      null,
      { Authorization: req.headers.authorization },
    );
  }
}
