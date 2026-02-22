import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { EventsService } from './events/events.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  /**
   * 1️⃣ Crear orden en estado PENDING
   */
  async create(createOrderDto: CreateOrderDto) {
    this.logger.log(`Creating order for user: ${createOrderDto.userId}`);

    // Calcular total
    const totalAmount = createOrderDto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Crear orden con items
    const order = await this.prisma.order.create({
      data: {
        userId: createOrderDto.userId,
        totalAmount,
        notes: createOrderDto.notes,
        paymentMethod: createOrderDto.paymentMethod,
        status: OrderStatus.PENDING,
        items: {
          create: createOrderDto.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    this.logger.log(`✅ Order created: ${order.id} (PENDING)`);

    // 2️⃣ Emitir evento order.created
    await this.emitOrderCreated(order);

    return order;
  }

  /**
   * 2️⃣ Emitir evento order.created
   */
  private async emitOrderCreated(order: any) {
    const eventData = {
      orderId: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
    };

    this.logger.log(`📢 Emitting order.created event for order ${order.id}`);
    
    await this.eventsService.emitEvent('order.created', eventData);
    
    // También podemos enviar un comando para verificar inventario inmediatamente
    // Esto es opcional, depende de tu arquitectura
    this.checkInventory(order.id, eventData.items);
  }

  /**
   * Opcional: Verificar inventario inmediatamente
   */
  private async checkInventory(orderId: string, items: any[]) {
    try {
      const inventoryCheck = await this.eventsService.sendCommand('inventory.check', {
        orderId,
        items,
      });
      
      this.logger.log(`Inventory check result for order ${orderId}:`, inventoryCheck);
    } catch (error) {
      this.logger.error(`Failed to check inventory for order ${orderId}`, error);
    }
  }

  /**
   * 3️⃣ Esperar confirmación vía evento
   * Este método será llamado desde el EventsController
   */
  async confirmOrder(orderId: string, paymentId?: string) {
    this.logger.log(`✅ Confirming order: ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order ${orderId} is not in PENDING state`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        paymentId,
        completedAt: new Date(),
      },
      include: { items: true },
    });

    // Emitir evento de orden confirmada
    await this.eventsService.emitEvent('order.confirmed', {
      orderId: updatedOrder.id,
      userId: updatedOrder.userId,
      status: updatedOrder.status,
      paymentId,
      confirmedAt: new Date(),
    });

    this.logger.log(`✅ Order ${orderId} confirmed successfully`);
    return updatedOrder;
  }

  /**
   * Rechazar orden (por falta de stock, pago rechazado, etc.)
   */
  async rejectOrder(orderId: string, reason: string) {
    this.logger.log(`❌ Rejecting order: ${orderId} - Reason: ${reason}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.REJECTED,
        notes: reason,
        cancelledAt: new Date(),
      },
    });

    // Emitir evento de orden rechazada
    await this.eventsService.emitEvent('order.rejected', {
      orderId: updatedOrder.id,
      userId: updatedOrder.userId,
      reason,
      rejectedAt: new Date(),
    });

    return updatedOrder;
  }

  /**
   * Obtener una orden por ID
   */
  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  /**
   * Obtener órdenes de un usuario
   */
  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtener todas las órdenes (admin)
   */
  async findAll(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : {},
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
