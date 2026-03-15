// payment.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { CreatePaymentDto } from '../src/payments/dto/create-payment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly client: MercadoPagoConfig;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Inicializar cliente de Mercado Pago
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN'),
      options: { timeout: 5000 },
    });
  }

  /**
   * Crear preferencia de pago en Mercado Pago
   */
  async createPayment(dto: CreatePaymentDto) {
    this.logger.log(`💳 Creando preferencia de pago para orden: ${dto.orderId}`);

    try {
      // Obtener la orden para verificar que existe
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { items: true },
      });

      if (!order) {
        throw new BadRequestException('Orden no encontrada');
      }

      const preference = new Preference(this.client);

      const response = await preference.create({
        body: {
          binary_mode: true,
          purpose: 'wallet_purchase',
          items: [
            {
              id: dto.orderId,
              title: dto.description,
              quantity: 1,
              unit_price: dto.amount,
              currency_id: 'ARS',
              description: `Pago de orden #${order.orderNumber || dto.orderId}`,
            },
          ],
          payer: {
            name: 'Juan',
            surname: 'Lopez',
            email: 'user@email.com',
            phone: {
              area_code: '11',
              number: '4444-4444',
            },
            identification: {
              type: 'DNI',
              number: '12345678',
            },
            address: {
              street_name: 'Street',
              street_number: '123',
              zip_code: '5700',
            },
          },
          // URLs de retorno - IMPORTANTE
          back_urls: {
            success: `${this.configService.get('API_URL')}/payment/success`,
            failure: `${this.configService.get('API_URL')}/payment/failure`,
            pending: `${this.configService.get('API_URL')}/payment/pending`,
          },
          auto_return: 'approved',
          external_reference: dto.orderId, // Para identificar la orden en callbacks
          notification_url: `${this.configService.get('API_URL')}/payment/webhook`, // Webhook
          metadata: {
            orderId: dto.orderId,
            userId: order.userId,
          },
        },
      });

      // Guardar referencia del pago en la base de datos
      await this.prisma.payment.create({
        data: {
          paymentId: response.id,
          orderId: dto.orderId,
          amount: dto.amount,
          status: 'PENDING',
          preferenceId: response.id,
          initPoint: response.init_point,
          metadata: {
            description: dto.description,
          },
        },
      });

      this.logger.log(`✅ Preferencia creada: ${response.id}`);

      return {
        checkoutUrl: response.init_point,
        preferenceId: response.id,
        orderId: dto.orderId,
      };
    } catch (error) {
      this.logger.error(`❌ Error creando pago: ${error.message}`, error.stack);
      throw new BadRequestException('Error al procesar el pago');
    }
  }

  /**
   * Manejar pago exitoso (desde back_urls)
   */
  async handleSuccessfulPayment(data: {
    paymentId: string;
    status: string;
    orderId: string;
    merchantOrderId?: string;
    preferenceId?: string;
  }) {
    this.logger.log(`💰 Pago exitoso: ${data.paymentId}`);

    // Actualizar el pago en la base de datos
    await this.prisma.payment.updateMany({
      where: { paymentId: data.paymentId },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        metadata: {
          merchantOrderId: data.merchantOrderId,
          preferenceId: data.preferenceId,
        },
      },
    });

    // Actualizar la orden
    const updatedOrder = await this.prisma.order.update({
      where: { id: data.orderId },
      data: {
        paymentStatus: 'PAID',
        paymentId: data.paymentId,
        paymentDate: new Date(),
        status: 'CONFIRMED', // Avanzar al siguiente estado
      },
    });

    this.logger.log(`✅ Orden ${data.orderId} confirmada por pago`);
    
    return updatedOrder;
  }

  /**
   * Manejar pago fallido
   */
  async handleFailedPayment(data: {
    paymentId: string;
    status: string;
    orderId: string;
  }) {
    this.logger.log(`❌ Pago fallido: ${data.paymentId}`);

    await this.prisma.payment.updateMany({
      where: { paymentId: data.paymentId },
      data: {
        status: 'FAILED',
        metadata: { errorStatus: data.status },
      },
    });

    await this.prisma.order.update({
      where: { id: data.orderId },
      data: {
        paymentStatus: 'FAILED',
      },
    });
  }

  /**
   * Manejar pago pendiente
   */
  async handlePendingPayment(data: {
    paymentId: string;
    status: string;
    orderId: string;
  }) {
    this.logger.log(`⏳ Pago pendiente: ${data.paymentId}`);

    await this.prisma.payment.updateMany({
      where: { paymentId: data.paymentId },
      data: {
        status: 'PENDING',
      },
    });

    await this.prisma.order.update({
      where: { id: data.orderId },
      data: {
        paymentStatus: 'PENDING',
      },
    });
  }

  /**
   * Webhook para notificaciones de Mercado Pago
   */
  async handleWebhook(topic: string, id: string, body: any) {
    this.logger.log(`🔔 Webhook recibido: ${topic} - ${id}`);

    switch (topic) {
      case 'payment':
        await this.handlePaymentNotification(id);
        break;
      case 'merchant_order':
        await this.handleMerchantOrderNotification(id);
        break;
      default:
        this.logger.warn(`Topic no manejado: ${topic}`);
    }
  }

  /**
   * Procesar notificación de pago
   */
  private async handlePaymentNotification(paymentId: string) {
    try {
      // Aquí consultarías la API de MP para obtener detalles del pago
      // const paymentInfo = await this.mercadopago.payment.get(paymentId);
      
      // Por ahora, simulamos
      this.logger.log(`Procesando notificación de pago: ${paymentId}`);
      
      // Actualizar según el estado real del pago
      await this.prisma.payment.updateMany({
        where: { paymentId },
        data: {
          notificationReceived: true,
          notifiedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Error procesando webhook: ${error.message}`);
    }
  }

  /**
   * Procesar notificación de orden
   */
  private async handleMerchantOrderNotification(orderId: string) {
    this.logger.log(`Procesando notificación de orden: ${orderId}`);
    // Lógica para notificaciones de orden
  }

  /**
   * Obtener estado del pago
   */
  async getPaymentStatus(orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        total: true,
      },
    });

    return {
      order,
      payment,
    };
  }
}
