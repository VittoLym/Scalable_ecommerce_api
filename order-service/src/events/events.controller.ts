import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { OrdersService } from '../app.service';
import { Logger } from '@nestjs/common';

@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Escuchar confirmación de pago
   */
  @EventPattern('payment.confirmed')
  async handlePaymentConfirmed(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log('💰 Payment confirmed event received:', data);

    const { orderId, paymentId } = data;

    try {
      // 3️⃣ Confirmar orden cuando llega el pago
      const order = await this.ordersService.confirmOrder(orderId, paymentId);
      
      this.logger.log(`✅ Order ${orderId} confirmed via payment event`);
      
      const channel = context.getChannelRef();
      const originalMsg = context.getMessage();
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Failed to confirm order ${orderId}`, error);
      
      // Rechazar orden si hay error
      await this.ordersService.rejectOrder(orderId, error.message);
      
      const channel = context.getChannelRef();
      const originalMsg = context.getMessage();
      channel.ack(originalMsg);
    }
  }

  /**
   * Escuchar confirmación de inventario
   */
  @EventPattern('inventory.confirmed')
  async handleInventoryConfirmed(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('📦 Inventory confirmed event received:', data);

    const { orderId, available } = data;

    if (!available) {
      // Si no hay inventario, rechazar orden
      await this.ordersService.rejectOrder(orderId, 'Insufficient inventory');
    }

    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  /**
   * Escuchar rechazo de pago
   */
  @EventPattern('payment.rejected')
  async handlePaymentRejected(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('❌ Payment rejected event received:', data);

    const { orderId, reason } = data;

    // Rechazar orden por pago fallido
    await this.ordersService.rejectOrder(orderId, `Payment rejected: ${reason}`);

    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  /**
   * Escuchar actualización de inventario
   */
  @EventPattern('inventory.updated')
  async handleInventoryUpdated(@Payload() data: any, @Ctx() context: RmqContext) {
    // Puedes usar esto para notificar al usuario si hay cambios en productos que ordenó
    this.logger.log('Inventory updated:', data);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }
}
