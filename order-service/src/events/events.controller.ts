/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    try {
      const {
        orderId,
        transactionId,
        amount,
        paymentMethod,
        providerResponse } = data;
      
      this.logger.log(`Procesando pago para orden ${orderId}, transacción: ${transactionId}`);
      const order = await this.ordersService.processPayment(orderId, {
        paymentMethod: paymentMethod || 'CREDIT_CARD',
        transactionId,
        amount,
        providerResponse,
      });
      
      this.logger.log(`✅ Orden ${orderId} procesada exitosamente - Estado: ${order.status}`);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`❌ Error procesando pago para orden ${data.orderId}:`, error.message);
      try {
        await this.ordersService.rejectOrder(
          data.orderId, 
          `Pago fallido: ${error.message}`
        );
        this.logger.log(`Orden ${data.orderId} rechazada por fallo de pago`);
      } catch (rejectError) {
        this.logger.error(`Error al rechazar orden ${data.orderId}:`, rejectError.message);
      }
      channel.ack(originalMsg);
    }
  }
  @EventPattern('inventory.confirmed')
  async handleInventoryConfirmed(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('📦 Inventory confirmed event received:', data);
    
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    
    try {
      const { orderId, available, items, reservationId } = data;
      
      if (!available) {
        // Si no hay inventario, rechazar orden
        this.logger.warn(`❌ Inventario insuficiente para orden ${orderId}`);
        
        await this.ordersService.rejectOrder(
          orderId, 
          'Inventario insuficiente para completar la orden'
        );
      } else {
        this.logger.log(`✅ Inventario confirmado para orden ${orderId}`);
        
        // Aquí podrías guardar el reservationId si lo necesitas
        // O actualizar algún campo en la orden si es necesario
        this.logger.log(`Reserva ${reservationId} confirmada para ${items?.length || 0} productos`);
      }
      
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Error procesando confirmación de inventario:`, error.message);
      channel.ack(originalMsg); // Confirmar igual para no bloquear la cola
    }
  }
  @EventPattern('payment.rejected')
  async handlePaymentRejected(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('❌ Payment rejected event received:', data);
    
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    
    try {
      const { orderId, reason, transactionId } = data;
      
      this.logger.warn(`Pago rechazado para orden ${orderId}: ${reason || 'Sin razón'}`);
      if (transactionId) {
        this.logger.log(`Transacción: ${transactionId}`);
      }
      
      await this.ordersService.rejectOrder(
        orderId, 
        `Pago rechazado: ${reason || 'Error en el procesamiento del pago'}`
      );
      
      this.logger.log(`✅ Orden ${orderId} rechazada correctamente`);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Error procesando rechazo de pago:`, error.message);
      channel.ack(originalMsg);
    }
  }
  @EventPattern('inventory.updated')
  async handleInventoryUpdated(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('📦 Inventory updated event received:', data);
    
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    
    try {
      const { productId, oldStock, newStock, updatedBy } = data;
      
      this.logger.log(`Producto ${productId}: stock actualizado de ${oldStock} a ${newStock} (por ${updatedBy || 'sistema'})`);
      
      // Aquí podrías buscar órdenes pendientes que contengan este producto
      // y notificar a los usuarios, etc.
      
      // Por ahora solo logueamos
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Error procesando actualización de inventario:`, error.message);
      channel.ack(originalMsg);
    }
  }
  @EventPattern('order.created.confirmation')
  async handleOrderCreatedConfirmation(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('📝 Order created confirmation received:', data);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    try {
      const { orderId, status, message } = data;
      this.logger.log(`Orden ${orderId} confirmada por sistema externo: ${message || 'Sin mensaje'}`);
      // Si el sistema externo ya procesó algo, podrías actualizar la orden
      // Por ejemplo, si ya se reservó inventario en otro servicio
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Error procesando confirmación:`, error.message);
      channel.ack(originalMsg);
    }
  }
  @EventPattern('shipping.updated')
  async handleShippingUpdated(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('🚚 Shipping updated event received:', data);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    try {
      const { orderId, status, trackingNumber, carrier, estimatedDelivery } = data;
      this.logger.log(`Envío actualizado para orden ${orderId}: ${status} - Guía: ${trackingNumber || 'N/A'}`);
      // Actualizar fulfillment en la orden
      await this.ordersService.updateFulfillment(orderId, {
        status: this.mapShippingStatusToFulfillment(status),
        carrier,
        trackingNumber,
        trackingUrl: trackingNumber ? `https://www.carrier.com/track/${trackingNumber}` : undefined,
      });
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Error procesando actualización de envío:`, error.message);
      channel.ack(originalMsg);
    }
  }
  private mapShippingStatusToFulfillment(shippingStatus: string): any {
    const statusMap = {
      'pending': 'PENDING',
      'processing': 'PROCESSING',
      'shipped': 'SHIPPED',
      'delivered': 'DELIVERED',
      'returned': 'RETURNED',
      'failed': 'FAILED',
    };
    return statusMap[shippingStatus?.toLowerCase()] || 'PENDING';
  }
  @EventPattern('order.retry')
  async handleRetry(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.warn('🔄 Retry event received:', data);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    try {
      const { originalEvent, orderId, attempts, error } = data;
      this.logger.warn(`Reintentando evento ${originalEvent} para orden ${orderId} (intento ${attempts})`);
      this.logger.warn(`Error original: ${error}`);
      // Aquí implementarías lógica de reintento
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Error en reintento:`, error.message);
      channel.ack(originalMsg);
    }
  }
}
