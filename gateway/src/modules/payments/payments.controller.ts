import {
  Get,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { ProxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('payments')
export class PaymentsController {
  constructor(readonly proxyRequest: ProxyRequest) {}
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthStatus(): object {
    return {
      message: 'hola',
      status: 'Payments is Done',
    };
  }
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req, @Body() body) {
    return this.proxyRequest.request(
      'POST',
      `${process.env.PAYMENT_SERVICE_URL}/payments/create`,
      body,
      {
        headers: {
          Authorization: req.headers.authorization
        },
      },
    );
  }
}
