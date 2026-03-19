import { Body, Controller, Post } from '@nestjs/common';
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('auth')
export class AuthController {
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
    return proxyRequest(
      'POST',
      `${process.env.USER_SERVICE_URL}/auth/register`,
      body,
      {},
    );
  }
}
