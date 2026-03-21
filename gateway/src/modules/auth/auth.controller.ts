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
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';
import type { Request } from 'express';

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
  // 🔑 FORGOT PASSWORD
  @Post('forgot-password')
  forgotPassword(@Body() body) {
    try {
      const response = proxyRequest(
        'POST',
        `${process.env.USER_SERVICE_URL}/auth/forgot-password`,
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
  resetPassword(@Body() body, @Req() req: Request) {
    try {
      const response = proxyRequest(
        'POST',
        `${process.env.USER_SERVICE_URL}/auth/reset-password`,
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
  info(@Body() body, @Req() req: Request) {
    try {
      const response = proxyRequest(
        'GET',
        `${process.env.USER_SERVICE_URL}/auth/info`,
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
