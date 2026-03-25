// rabbit/order-rabbit.client.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout, catchError, throwError } from 'rxjs';
import { TimeoutError } from 'rxjs';

export interface OrderData {
  id: string;
  orderNumber: string;
  userId: string;
  total: number;
  status: string;
  items: any[];
  shippingAddress: any;
}

@Injectable()
export class OrderRabbitClient {
  private readonly logger = new Logger(OrderRabbitClient.name);
  private readonly timeoutMs = 5000; // 5 segundos de timeout

  constructor(@Inject('ORDER_SERVICE') private readonly client: ClientProxy) {}
  async onApplicationBootstrap() {
    try {
      await this.client.connect();
      this.logger.log('✅ Conectado a RabbitMQ para Order Service');
    } catch (error) {
      this.logger.error('❌ Error conectando a Order Service:', error.message);
    }
  }
  async getOrderById(orderId: string): Promise<OrderData> {
    this.logger.log(`🔍 Solicitando orden ${orderId} a Order Service`);
    try {
      const response = await lastValueFrom(
        this.client.send('order.get_by_id', { orderId }).pipe(
          timeout(this.timeoutMs),
          catchError((err) => {
            if (err instanceof TimeoutError) {
              throw new Error('Timeout al obtener la orden');
            }
            return throwError(() => err);
          }),
        ),
      );

      if (!response || !response.success) {
        throw new Error(response?.error || 'Error al obtener la orden');
      }

      this.logger.log(`✅ Orden ${orderId} obtenida exitosamente`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Error obteniendo orden ${orderId}:`, error.message);
      throw error;
    }
  }
  async checkOrderExists(orderId: string): Promise<boolean> {
    try {
      const response = await lastValueFrom(
        this.client
          .send('order.exists', { orderId })
          .pipe(timeout(this.timeoutMs)),
      );

      return response?.data?.exists || false;
    } catch (error) {
      this.logger.error(`❌ Error verificando orden ${orderId}:`, error.message);
      return false;
    }
  }
  async updateOrderPaymentStatus(
    orderId: string,
    paymentData: {
      paymentId: string;
      paymentStatus: string;
      paymentDate: Date;
    },
  ): Promise<any> {
    this.logger.log(`💳 Actualizando estado de pago de orden ${orderId}`);

    try {
      const response = await lastValueFrom(
        this.client
          .send('order.update_payment_status', {
            orderId,
            ...paymentData,
          })
          .pipe(timeout(this.timeoutMs)),
      );

      if (!response || !response.success) {
        throw new Error(response?.error || 'Error actualizando estado de pago');
      }

      this.logger.log(`✅ Estado de pago actualizado para orden ${orderId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Error actualizando pago:`, error.message);
      throw error;
    }
  }
}
