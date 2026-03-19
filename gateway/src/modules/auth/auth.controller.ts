import {
  Get,
  Body,
  Query,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('auth')
export class AuthController {
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthStatus(): object {
    return {
      message: 'Auth is Done',
    };
  }
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return proxyRequest(
      'GET',
      `${process.env.USER_SERVICE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
      null,
      {},
    );
  }
  @Post('login')
  login(@Body() body) {
    return proxyRequest(
      'POST',
      `${process.env.USER_SERVICE_URL}/auth/login`,
      body,
      {},
    );
  }
  @Post('register')
  register(@Body() body) {
    console.log('Register By Gateway');
    return proxyRequest(
      'POST',
      `${process.env.USER_SERVICE_URL}/auth/register`,
      body,
      {},
    );
  }
  @Post('refresh')
  refresh(@Body() body) {
    console.log('Login By Gateway');
    return proxyRequest(
      'POST',
      `${process.env.USER_SERVICE_URL}/auth/refresh`,
      body,
      {},
    );
  }
  @Post('logout')
  logout(@Body() body) {
    return proxyRequest(
      'POST',
      `${process.env.USER_SERVICE_URL}/auth/logout`,
      body,
      {},
    );
  }
}
