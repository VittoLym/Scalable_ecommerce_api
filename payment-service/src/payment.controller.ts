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
  Redirect,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from '../src/payments/dto/create-payment.dto';
import { Public } from '../decorators/public.decorator';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Crear un nuevo pago
   */
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

  /**
   * Endpoint para pagos exitosos
   * Mercado Pago redirige aquí
   */
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

    // Puedes redirigir al frontend o mostrar una página
    return {
      success: true,
      message: 'Pago procesado exitosamente',
      data: {
        orderId: externalReference,
        paymentId,
      },
      redirectUrl: `http://localhost:3000/orders/${externalReference}/success`,
    };
  }

  /**
   * Endpoint para pagos fallidos
   */
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
      redirectUrl: `http://localhost:3000/orders/${externalReference}/failure`,
    };
  }

  /**
   * Endpoint para pagos pendientes
   */
  @Get('pending')
  @Public()
  @HttpCode(HttpStatus.OK)
  async paymentPending(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
  ) {
    this.logger.log(`⏳ Pago pendiente - Payment ID: ${paymentId}`);

    await this.paymentService.handlePendingPayment({
      paymentId,
      status,
      orderId: externalReference,
    });

    return {
      success: true,
      message: 'El pago está pendiente de confirmación',
      data: {
        orderId: externalReference,
        paymentId,
      },
      redirectUrl: `http://localhost:3000/orders/${externalReference}/pending`,
    };
  }

  /**
   * Webhook para notificaciones automáticas de Mercado Pago
   */
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Body() body: any,
    @Query('topic') topic?: string,
    @Query('id') id?: string,
  ) {
    this.logger.log(`🔔 Webhook recibido - Topic: ${topic}, ID: ${id}`);

    await this.paymentService.handleWebhook(topic, id, body);

    return { received: true };
  }

  /**
   * Obtener estado del pago por orden
   */
  @Get('status/:orderId')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getPaymentStatus(@Param('orderId') orderId: string) {
    const status = await this.paymentService.getPaymentStatus(orderId);
    
    return {
      success: true,
      data: status,
    };
  }
}
