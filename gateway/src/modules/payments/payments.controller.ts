import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('payments')
export class PaymentsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req, @Body() body) {
    return proxyRequest(
      'POST',
      `${process.env.PAYMENT_SERVICE_URL}/payments/create`,
      body,
      { Authorization: req.headers.authorization },
    );
  }
}
