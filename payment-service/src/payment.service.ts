import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';
import { OrderRabbitClient } from './rabbit/order.rabbit.client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly client: MercadoPagoConfig;

  constructor(
    private readonly orderRabbitClient: OrderRabbitClient,
    private configService: ConfigService,
  ) {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new InternalServerErrorException(
        'MP_ACCESS_TOKEN no está configurado en las variables de entorno',
      );
    }
    this.client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 5000 },
    });
  }
  async createPayment(dto: CreatePaymentDto) {
    this.logger.log(
      `💳 Creando preferencia de pago para orden: ${dto.orderId}`,
    );
    try {
      const order = await this.orderRabbitClient.getOrderById(dto.orderId);
      if (!order) {
        throw new NotFoundException(`Orden ${dto.orderId} no encontrada`);
      }
      this.logger.log(
        `📦 Orden encontrada: ${order.orderNumber} - Total: $${order.total}`,
      );
      if (order.status === 'CONFIRMED') {
        throw new NotFoundException(`Order Status is ${order.status}`);
      }
      const preference = new Preference(this.client);
      const response = await preference.create({
        body: {
          binary_mode: true,
          purpose: 'onboarding_credits',
          items: [
            {
              id: dto.orderId,
              title: dto.description,
              quantity: 1,
              unit_price: dto.amount || order.total,
              currency_id: 'ARS',
              description: `Pago de orden #${order.orderNumber || dto.orderId}`,
            },
          ],
          payer: {
            email: 'test_user_7458615897109620776@testuser.com',
          },
          back_urls: {
            success: `${this.configService.get('API_URL')}/payment/success`,
            failure: `${this.configService.get('API_URL')}/payment/failure`,
            pending: `${this.configService.get('API_URL')}/payment/pending`,
          },
          auto_return: 'approved',
          external_reference: dto.orderId,
          notification_url: `${this.configService.get('API_URL')}/payment/webhook`,
          metadata: {
            orderId: dto.orderId,
            orderNumber: order.orderNumber,
          },
        },
      });
      this.logger.log(`✅ Preferencia creada: ${response.id}`);
      return {
        checkoutUrl: response.init_point,
        preferenceId: response.id,
        orderId: dto.orderId,
        orderNumber: order.orderNumber,
      };
    } catch (error) {
      this.logger.error(`❌ Error creando pago: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al procesar el pago');
    }
  }

  async handleSuccessfulPayment(data: {
    paymentId: string;
    status: string;
    orderId: string;
    merchantOrderId?: string;
    preferenceId?: string;
  }) {
    this.logger.log(`💰 Procesando pago exitoso: ${data.paymentId}`);

    try {
      const updatedOrder = await this.orderRabbitClient.updateOrderPaymentStatus(
        data.orderId,
        {
          paymentId: data.paymentId,
          paymentStatus: 'PAID',
          paymentDate: new Date(),
        });

      this.logger.log(`✅ Orden ${data.orderId} actualizada con pago exitoso`);
      return updatedOrder;
    } catch (error) {
      this.logger.error(`❌ Error actualizando orden: ${error.message}`);
      throw error;
    }
  }

  async handleFailedPayment(data: {
    paymentId: string;
    status: string;
    orderId: string;
  }) {
    this.logger.log(`❌ Procesando pago fallido: ${data.paymentId}`);

    try {
      await this.orderRabbitClient.updateOrderPaymentStatus(data.orderId, {
        paymentId: data.paymentId,
        paymentStatus: 'FAILED',
        paymentDate: new Date(),
      });
    } catch (error) {
      this.logger.error(`❌ Error actualizando orden fallida: ${error.message}`);
    }
  }
}
