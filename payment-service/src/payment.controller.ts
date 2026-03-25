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
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';
import { Public } from './decorator/public.decorator';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

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
    try {
      this.logger.log('💳 Creando nuevo pago');
      const result = await this.paymentService.createPayment(createPaymentDto);
      return {
        success: true,
        message: 'Preferencia de pago creada',
        data: result,
      };
    } catch (e) {
      if (e instanceof NotFoundException) {
        if (e.message === 'Order Status is CONFIRMED') {
          return {
            success: false,
            message: e.message,
          };
        }
      }
      this.logger.log(e);
    }
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
      message: updatedOrder.message ? updatedOrder.message : 'Pago procesado exitosamente',
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
  @EventPattern('order.created')
  async handleOrderCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    this.logger.log('🔥🔥🔥 EVENTO RECIBIDO EN PAYMENT SERVICE 🔥🔥🔥');
    this.logger.log(`📦 Datos recibidos: ${JSON.stringify(data, null, 2)}`);
    try {
      channel.ack(originalMsg);
      const createPaymentDto: CreatePaymentDto = {
        amount: data.totalAmount,
        orderId: data.orderId,
        description: `Pago de orden #${data.orderNumber}`,
      };
      const result = await this.paymentService.createPayment(createPaymentDto);
      this.logger.log(`✅ Pago creado automáticamente para orden ${data.orderId}`);
      this.logger.log(`🔗 Checkout URL: ${result.checkoutUrl}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error procesando orden: ${error.message}`);
      // No rechazar el mensaje para no reintentar
      channel.ack(originalMsg);
      return { success: false, error: error.message };
    }
  }
  @Get('diagnostic')
  @Public()
  async diagnostic() {
    this.logger.log('🔍 Diagnosticando estado del microservicio');
    return {
      service: 'payment-service',
      status: 'running',
      microservices: {
        paymentEvents: {
          queue: 'payment_events',
          isConnected: this.isMicroserviceConnected(),
        },
        orderServiceQueue: {
          queue: 'order_service_queue',
          isConnected: this.isOrderServiceConnected(),
        },
      },
      handlers: {
        'order.created': 'registered',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private isMicroserviceConnected(): boolean {
    // Verificar estado del microservicio
    return true; // Implementar según tu lógica
  }

  private isOrderServiceConnected(): boolean {
    return true; // Implementar según tu lógica
  }
  @Get('ping')
  @Public()
  async ping() {
    this.logger.log('🏓 Pong!');
    return {
      pong: true,
      service: 'payment-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
