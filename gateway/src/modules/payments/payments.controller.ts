import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from './dto/skip-roles.decorator';
import { ProxyRequest } from 'src/common/interceptor/proxy.interceptor';

const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly proxyRequest: ProxyRequest) {}

  @Get()
  @Public()
  getHola() {
    this.logger.log('mandarina con pollo');
    return 'hola chirimbola';
  }

  /**
   * Crear preferencia de pago
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(@Body() createPaymentDto: any, @Req() req: Request) {
    this.logger.log('💳 Creando nuevo pago');
    try {
      const result = await this.proxyRequest.request(
        'POST',
        `${PAYMENT_SERVICE_URL}/payment`,
        createPaymentDto,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 10000,
        },
      );
      return result;
    } catch (error) {
      this.logger.error(`Error creando pago: ${error.message}`);
      throw error;
    }
  }

  /**
   * Callback de pago exitoso - Mercado Pago redirige aquí
   */
  @Get('success')
  @Public()
  @HttpCode(HttpStatus.OK)
  async paymentSuccess(
    @Req() req: Request,
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
    @Query('merchant_order_id') merchantOrderId?: string,
    @Query('preference_id') preferenceId?: string,
  ) {
    this.logger.log(`✅ Pago exitoso - Payment ID: ${paymentId}`);

    const queryParams = new URLSearchParams({
      payment_id: paymentId,
      status,
      external_reference: externalReference,
      ...(merchantOrderId && { merchant_order_id: merchantOrderId }),
      ...(preferenceId && { preference_id: preferenceId }),
    }).toString();

    const result = await this.proxyRequest.request(
      'GET',
      `${PAYMENT_SERVICE_URL}/payment/success?${queryParams}`,
      null,
      {
        headers: { authorization: req.headers.authorization },
        timeout: 10000,
      },
    );
    return result;
  }

  /**
   * Callback de pago fallido - Mercado Pago redirige aquí
   */
  @Get('failure')
  @Public()
  @HttpCode(HttpStatus.OK)
  async paymentFailure(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
    @Req() req: Request,
  ) {
    this.logger.log(`❌ Pago fallido - Payment ID: ${paymentId}`);

    const queryParams = new URLSearchParams({
      payment_id: paymentId,
      status,
      external_reference: externalReference,
    }).toString();

    const result = await this.proxyRequest.request(
      'GET',
      `${PAYMENT_SERVICE_URL}/payment/failure?${queryParams}`,
      null,
      {
        headers: { authorization: req.headers.authorization },
        timeout: 10000,
      },
    );
    return result;
  }

  /**
   * Callback de pago pendiente - Mercado Pago redirige aquí
   */
  @Get('pending')
  @Public()
  @HttpCode(HttpStatus.OK)
  async paymentPending(
    @Query('payment_id') paymentId: string,
    @Query('status') status: string,
    @Query('external_reference') externalReference: string,
    @Req() req: Request,
  ) {
    this.logger.log(`⏳ Pago pendiente - Payment ID: ${paymentId}`);

    const queryParams = new URLSearchParams({
      payment_id: paymentId,
      status,
      external_reference: externalReference,
    }).toString();

    const result = await this.proxyRequest.request(
      'GET',
      `${PAYMENT_SERVICE_URL}/payment/pending?${queryParams}`,
      null,
      {
        headers: { authorization: req.headers.authorization },
        timeout: 10000,
      },
    );
    return result;
  }

  /**
   * Webhook de Mercado Pago
   */
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Body() body: any,
    @Req() req: Request,
    @Query('topic') topic?: string,
    @Query('id') id?: string,
  ) {
    this.logger.log(`🔔 Webhook recibido - Topic: ${topic}, ID: ${id}`);

    try {
      const queryParams = new URLSearchParams({
        ...(topic && { topic }),
        ...(id && { id }),
      }).toString();

      const result = await this.proxyRequest.request(
        'POST',
        `${PAYMENT_SERVICE_URL}/payment/webhook${queryParams ? `?${queryParams}` : ''}`,
        body,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 10000,
        },
      );
      return result;
    } catch (error) {
      this.logger.error(`Error procesando webhook: ${error.message}`);
      // Siempre responder OK a Mercado Pago aunque haya error
      return { received: true };
    }
  }

  /**
   * Diagnosticar estado del servicio de pagos
   */
  @Get('diagnostic')
  @Public()
  async diagnostic(@Req() req: Request) {
    this.logger.log('🔍 Diagnosticando estado del servicio de pagos');

    try {
      const result = await this.proxyRequest.request(
        'GET',
        `${PAYMENT_SERVICE_URL}/payment/diagnostic`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return result;
    } catch (error) {
      this.logger.error(`Error en diagnóstico: ${error.message}`);
      return {
        service: 'payment-service',
        status: 'unavailable',
        gateway: 'healthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Health check del servicio de pagos
   */
  @Get('ping')
  @Public()
  async ping(@Req() req: Request) {
    this.logger.log('🏓 Pinging payment service...');

    try {
      const result = await this.proxyRequest.request(
        'GET',
        `${PAYMENT_SERVICE_URL}/payment/ping`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return result;
    } catch (error) {
      this.logger.error(`Error en ping: ${error.message}`);
      return {
        pong: false,
        service: 'payment-service',
        gateway: 'healthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
