import {
  Controller,
  Get,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { ProxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('users')
export class UsersController {
  constructor(readonly proxyRequest: ProxyRequest) {}
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthStatus(): object {
    return {
      message: 'hola',
      status: 'Users is Done',
    };
  }
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req) {
    return this.proxyRequest.request(
      'GET',
      `${process.env.USER_SERVICE_URL}/users/me`,
      null,
      {
        headers: {
          Authorization: req.headers.authorization
        },
      },
    );
  }
}
