import { Body, Controller, Post } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  async createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(dto);
  }
}
