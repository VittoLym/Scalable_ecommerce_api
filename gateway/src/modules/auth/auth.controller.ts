import {
  Get,
  Body,
  Req,
  Query,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ProxyRequest } from '../../common/interceptor/proxy.interceptor';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly proxyRequest: ProxyRequest) {}
  private user_url = process.env.USER_SERVICE_URL || 'http://localhost:3001';
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthStatus(): object {
    return {
      message: 'Auth is Done',
    };
  }
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.proxyRequest.request(
      'GET',
      `${this.user_url}/auth/verify-email?token=${encodeURIComponent(token)}`,
      null,
      {},
    );
  }
  @Post('login')
  async login(@Body() body) {
    console.log(process.env.USER_SERVICE_URL);
    return await this.proxyRequest.request(
      'POST',
      `${this.user_url}/auth/login`,
      body,
      {},
    );
  }
  @Post('register')
  async register(@Body() body) {
    console.log('Register By Gateway');
    console.log(this.user_url);
    console.log(body);
    return await this.proxyRequest.request(
      'POST',
      `${this.user_url}/auth/register`,
      body,
      {},
    );
  }
  @Post('refresh')
  async refresh(@Body() body) {
    console.log('Login By Gateway');
    return await this.proxyRequest.request(
      'POST',
      `${this.user_url}/auth/refresh`,
      body,
      {},
    );
  }
  @Post('logout')
  async logout(@Body() body) {
    return await this.proxyRequest.request(
      'POST',
      `${this.user_url}/auth/logout`,
      body,
      {},
    );
  }
  // 🔑 FORGOT PASSWORD
  @Post('forgot-password')
  async forgotPassword(@Body() body) {
    try {
      const response = await this.proxyRequest.request(
        'POST',
        `${this.user_url}/auth/forgot-password`,
        body,
        {},
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 🔄 RESET PASSWORD
  @Post('reset-password')
  async resetPassword(@Body() body, @Req() req: Request) {
    try {
      const response = await this.proxyRequest.request(
        'POST',
        `${this.user_url}/auth/reset-password`,
        body,
        {
          headers: {
            'x-forwarded-for': req.ip,
            'user-agent': req.headers['user-agent'],
          },
        },
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 🌐 INFO
  @Get('info')
  async info(@Body() body, @Req() req: Request) {
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${this.user_url}/auth/info`,
        body,
        {
          headers: {
            'x-forwarded-for': req.ip,
            'user-agent': req.headers['user-agent'],
          },
        },
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 🛠️ ERROR HANDLER CENTRAL
  private handleError(error: any) {
    if (error.response) {
      return new HttpException(error.response.data,error.response.status);
    }

    return new HttpException('Error en API Gateway', 500);
  }
}
