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
import { ProxyRequest } from '../../common/interceptor/proxy.interceptor';
@Controller('orders')
export class OrdersController {
  constructor(readonly proxyRequest: ProxyRequest) {}
  private order_url = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
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
    return this.proxyRequest.request('POST', `${this.order_url}/orders`, body, {
      headers: {
        Authorization: req.headers.authorization
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getAll(@Req() req) {
    return this.proxyRequest.request('GET', `${this.order_url}/orders`, null, {
      headers: {
        Authorization: req.headers.authorization
      },
    });
  }
  @Post('reserved-stock')
  test(@Body() body, @Req() req) {
    return this.proxyRequest.request(
      'POST',
      `${this.order_url}/orders/tested`,
      body,
      {
        headers: {
          Authorization: req.headers.authorization
        },
      },
    );
  }
}
