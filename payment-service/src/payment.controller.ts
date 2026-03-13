import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';

@Controller('payment')
export class PaymentController {
  private logger: Logger;
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  async createPayment(@Body() dto: CreatePaymentDto) {
    const payment = await this.paymentService.createPayment(dto);
    console.log(payment);
    return payment;
  }
  @Get()
  test1() {
    setTimeout(() => {
      console.log('hola');
    }, 5000);
    return 'hola';
  }
  @Get('success')
  @HttpCode(HttpStatus.OK)
  paymentSuccess(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
    @Query('merchant_order_id') merchantOrderId?: string,
    @Query('preference_id') preferenceId?: string,
  ) {
    this.logger.log(
      `✅ Pago exitoso recibido: ${JSON.stringify({
        paymentId,
        status,
        externalReference,
        merchantOrderId,
        preferenceId,
      })}`,
    );

    return {
      success: true,
      message: 'Pago procesado exitosamente',
      redirectUrl: `http://localhost:3000/orders/${externalReference}/success`,
    };
  }
  @Get('failure')
  @HttpCode(HttpStatus.OK)
  paymentFailure(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
  ) {
    this.logger.log(
      `❌ Pago fallido: ${JSON.stringify({
        paymentId,
        status,
        externalReference,
      })}`,
    );

    return {
      success: false,
      message: 'El pago no pudo ser procesado',
      redirectUrl: `http://localhost:3000/orders/${externalReference}/failure`,
    };
  }
  @Get('pending')
  @HttpCode(HttpStatus.OK)
  paymentPending(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
  ) {
    this.logger.log(
      `⏳ Pago pendiente: ${JSON.stringify({
        paymentId,
        status,
        externalReference,
      })}`,
    );

    return {
      success: true,
      message: 'El pago está pendiente de confirmación',
      redirectUrl: `http://localhost:3000/orders/${externalReference}/pending`,
    };
  }
}
