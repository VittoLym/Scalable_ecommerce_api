import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { OrderService } from '../order.service';
import { Logger } from '@nestjs/common';

@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly ordersService: OrderService) {}
  @EventPattern('payment.confirmed')
  async handlePaymentConfirmed(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log('💰 Payment confirmed event received:', data);
    const { orderId, paymentId } = data;
    try {
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
  @EventPattern('payment.rejected')
  async handlePaymentRejected(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('❌ Payment rejected event received:', data);
    const { orderId, reason } = data;
    await this.ordersService.rejectOrder(orderId, `Payment rejected: ${reason}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }
  @EventPattern('inventory.updated')
  async handleInventoryUpdated(@Payload() data: any, @Ctx() context: RmqContext) {
    // Puedes usar esto para notificar al usuario si hay cambios en productos que ordenó
    this.logger.log('Inventory updated:', data);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }
}
