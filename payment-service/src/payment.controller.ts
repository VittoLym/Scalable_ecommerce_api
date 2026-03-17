// payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';
import { Public } from './decorator/public.decorator';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  getHola() {
    this.logger.log('mandarina con pollo');
    return 'hola chirimbola';
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    this.logger.log('💳 Creando nuevo pago');
    const result = await this.paymentService.createPayment(createPaymentDto);
    return {
      success: true,
      message: 'Preferencia de pago creada',
      data: result,
    };
  }

  @Get('success')
  @Public()
  @HttpCode(HttpStatus.OK)
  async paymentSuccess(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
    @Query('merchant_order_id') merchantOrderId?: string,
    @Query('preference_id') preferenceId?: string,
  ) {
    this.logger.log(`✅ Pago exitoso - Payment ID: ${paymentId}`);

    const updatedOrder = await this.paymentService.handleSuccessfulPayment({
      paymentId,
      status,
      orderId: externalReference,
      merchantOrderId,
      preferenceId,
    });

    return {
      success: true,
      message: updatedOrder.message ? updatedOrder.message : 'Pago procesado exitosamente' ,
      data: {
        orderId: externalReference,
        paymentId,
        order: updatedOrder,
      },
    };
  }

  @Get('failure')
  @Public()
  @HttpCode(HttpStatus.OK)
  async paymentFailure(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
  ) {
    this.logger.log(`❌ Pago fallido - Payment ID: ${paymentId}`);

    await this.paymentService.handleFailedPayment({
      paymentId,
      status,
      orderId: externalReference,
    });

    return {
      success: false,
      message: 'El pago no pudo ser procesado',
      data: {
        orderId: externalReference,
        paymentId,
        status,
      },
    };
  }

  @Get('pending')
  @Public()
  @HttpCode(HttpStatus.OK)
  async paymentPending(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
  ) {
    this.logger.log(`⏳ Pago pendiente - Payment ID: ${paymentId}`);

    return {
      success: true,
      message: 'El pago está pendiente de confirmación',
      data: {
        orderId: externalReference,
        paymentId,
      },
    };
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Body() body: any,
    @Query('topic') topic?: string,
    @Query('id') id?: string,
  ) {
    this.logger.log(`🔔 Webhook recibido - Topic: ${topic}, ID: ${id}`);
    return { received: true };
  }
}
