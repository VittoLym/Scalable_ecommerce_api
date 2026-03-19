import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('orders')
export class OrdersController {
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthStatus(): object {
    return {
      message: 'hola',
      status: 'Orders is Done',
    };
  }
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req, @Body() body) {
    return proxyRequest(
      'POST',
      `${process.env.ORDER_SERVICE_URL}/orders`,
      body,
      { Authorization: req.headers.authorization },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getAll(@Req() req) {
    return proxyRequest(
      'GET',
      `${process.env.ORDER_SERVICE_URL}/orders`,
      null,
      { Authorization: req.headers.authorization },
    );
  }
}
