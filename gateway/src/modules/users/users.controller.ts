import {
  Controller,
  Get,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('users')
export class UsersController {
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
    return proxyRequest(
      'GET',
      `${process.env.USER_SERVICE_URL}/users/me`,
      null,
      { Authorization: req.headers.authorization },
    );
  }
}
