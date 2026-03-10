/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { EventsService } from './events/events.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, PaymentStatus, FulfillmentStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}
  async create(createOrderDto: CreateOrderDto) {
    this.logger.log(`📝 Creating order for user: ${createOrderDto.userId}`);
    const subtotal = createOrderDto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const taxAmount = createOrderDto.taxAmount || subtotal * 0.21; // 21% IVA por defecto
    const shippingAmount = createOrderDto.shippingAmount || 0;
    const discountAmount = createOrderDto.discountAmount || 0;
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId: createOrderDto.userId,
        userEmail: createOrderDto.userEmail,
        // Totales
        subtotal,
        taxAmount,
        shippingAmount,
        discountAmount,
        totalAmount,
        shippingAddress: createOrderDto.shippingAddress
          ? JSON.parse(JSON.stringify(createOrderDto.shippingAddress))
          : 'Adress',
        billingAddress: createOrderDto.billingAddress
          ? JSON.parse(JSON.stringify(createOrderDto.billingAddress))
          : createOrderDto.shippingAddress
            ? JSON.parse(JSON.stringify(createOrderDto.shippingAddress))
            : 'Adress',
        contactEmail: createOrderDto.contactEmail || createOrderDto.userEmail,
        contactPhone: createOrderDto.contactPhone,
        status: OrderStatus.PENDING,
        items: {
          create: createOrderDto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
            productSnapshot: item.productSnapshot || {
              productId: item.productId,
              name: item.productName || 'Producto',
              price: item.unitPrice,
            },
          })),
        },
        statusHistory: {
          create: {
            status: OrderStatus.PENDING,
            reason: 'Orden creada',
          },
        },
      },
      include: {
        items: true,
        statusHistory: true,
      },
    });
    this.logger.log(
      `✅ Order created: ${order.id} (${order.orderNumber}) - Status: PENDING`,
    );
    await this.emitOrderCreated(order);

    return order;
  }
  private async emitOrderCreated(order: any) {
    const eventData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      userEmail: order.userEmail,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      shippingAmount: order.shippingAmount,
      discountAmount: order.discountAmount,
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        productSnapshot: item.productSnapshot,
      })),
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
    };

    this.logger.log(`📢 Emitting order.created event for order ${order.id}`);
    await this.eventsService.emitEvent('order.created', eventData);
    // Enviar comando para verificar inventario
    this.checkInventory(order.id, order.items);
  }
  private async checkInventory(orderId: string, items: any[]) {
    try {
      const inventoryCheck = await this.eventsService.sendCommand(
        'inventory.check',
        {
          orderId,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      );
      this.logger.log(
        `Inventory check result for order ${orderId}:`,
        inventoryCheck,
      );
    } catch (error) {
      this.logger.error(
        `Failed to check inventory for order ${orderId}`,
        error,
      );
    }
  }
  async processPayment(
    orderId: string,
    paymentData: {
      paymentMethod: string;
      transactionId: string;
      amount: number;
      currency?: string;
      providerResponse?: any;
    },
  ) {
    this.logger.log(`💰 Processing payment for order: ${orderId}`);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order ${orderId} is not in PENDING state`);
    }
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        paymentMethod: paymentData.paymentMethod,
        status: PaymentStatus.PAID,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        transactionId: paymentData.transactionId,
        providerResponse: paymentData.providerResponse,
      },
    });
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PROCESSING,
        statusHistory: {
          create: {
            status: OrderStatus.PROCESSING,
            reason: `Pago procesado: ${paymentData.transactionId}`,
          },
        },
      },
      include: { items: true, payments: true },
    });
    await this.eventsService.emitEvent('payment.processed', {
      orderId,
      paymentId: payment.id,
      transactionId: paymentData.transactionId,
      status: 'PAID',
      amount: paymentData.amount,
    });
    await this.eventsService.emitEvent('order.processing', {
      orderId: updatedOrder.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: updatedOrder.status,
      paymentId: payment.id,
      processedAt: new Date(),
    });
    this.logger.log(`✅ Order ${orderId} is now PROCESSING`);
    return updatedOrder;
  }
  async updateFulfillment(
    orderId: string,
    fulfillmentData: {
      status: FulfillmentStatus;
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    },
  ) {
    this.logger.log(`📦 Updating fulfillment for order: ${orderId}`);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    const fulfillment = await this.prisma.fulfillment.create({
      data: {
        orderId,
        status: fulfillmentData.status,
        carrier: fulfillmentData.carrier,
        trackingNumber: fulfillmentData.trackingNumber,
        trackingUrl: fulfillmentData.trackingUrl,
        ...(fulfillmentData.status === 'SHIPPED' && { shippedAt: new Date() }),
        ...(fulfillmentData.status === 'DELIVERED' && {
          deliveredAt: new Date(),
        }),
      },
    });
    if (fulfillmentData.status === 'SHIPPED') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.SHIPPED,
          statusHistory: {
            create: {
              status: OrderStatus.SHIPPED,
              reason: `Enviado vía ${fulfillmentData.carrier} - Guía: ${fulfillmentData.trackingNumber}`,
            },
          },
        },
      });
      await this.eventsService.emitEvent('order.shipped', {
        orderId,
        trackingNumber: fulfillmentData.trackingNumber,
        carrier: fulfillmentData.carrier,
        trackingUrl: fulfillmentData.trackingUrl,
      });
    }
    if (fulfillmentData.status === 'DELIVERED') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
          statusHistory: {
            create: {
              status: OrderStatus.DELIVERED,
              reason: 'Entregado al cliente',
            },
          },
        },
      });
      await this.eventsService.emitEvent('order.delivered', {
        orderId,
        deliveredAt: new Date(),
      });
    }
    return fulfillment;
  }
  async rejectOrder(orderId: string, reason: string) {
    this.logger.log(`❌ Rejecting order: ${orderId} - Reason: ${reason}`);
    const order: any = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (![OrderStatus.PENDING, OrderStatus.PROCESSING].includes(order.status)) {
      throw new BadRequestException(
        `Order ${orderId} cannot be rejected (current status: ${order.status})`,
      );
    }
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        statusHistory: {
          create: {
            status: OrderStatus.CANCELLED,
            reason,
          },
        },
      },
      include: { items: true },
    });
    await this.eventsService.emitEvent('order.cancelled', {
      orderId: updatedOrder.id,
      userId: updatedOrder.userId,
      reason,
      cancelledAt: new Date(),
    });
    return updatedOrder;
  }
  async refundOrder(orderId: string, reason: string) {
    this.logger.log(`💸 Processing refund for order: ${orderId}`);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.SHIPPED
    ) {
      throw new BadRequestException(
        `Order ${orderId} cannot be refunded (current status: ${order.status})`,
      );
    }
    const refundPayment = await this.prisma.payment.create({
      data: {
        orderId,
        paymentMethod: order.payments[0]?.paymentMethod || 'REFUND',
        status: PaymentStatus.REFUNDED,
        amount: -order.totalAmount, // Negativo para reembolso
        currency: 'USD',
      },
    });
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.REFUNDED,
        statusHistory: {
          create: {
            status: OrderStatus.REFUNDED,
            reason: `Reembolsado: ${reason}`,
          },
        },
      },
    });
    await this.eventsService.emitEvent('order.refunded', {
      orderId,
      reason,
      refundAmount: order.totalAmount,
      refundedAt: new Date(),
    });

    return updatedOrder;
  }
  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        fulfillments: {
          include: { items: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }
  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        payments: true,
        fulfillments: true,
        statusHistory: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }
    return order;
  }
  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        payments: true,
        statusHistory: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async findAll(status?: OrderStatus, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: status ? { status } : {},
        include: {
          items: true,
          payments: true,
          statusHistory: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({
        where: status ? { status } : {},
      }),
    ]);
    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  async getStats() {
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { status: OrderStatus.PROCESSING } }),
      this.prisma.order.count({
        where: {
          status: {
            in: [OrderStatus.DELIVERED, OrderStatus.SHIPPED],
          },
        },
      }),
      this.prisma.order.count({
        where: {
          status: {
            in: [OrderStatus.CANCELLED, OrderStatus.REFUNDED],
          },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          status: {
            in: [
              OrderStatus.DELIVERED,
              OrderStatus.SHIPPED,
              OrderStatus.PROCESSING,
            ],
          },
        },
        _sum: { totalAmount: true },
      }),
    ]);
    return {
      total: totalOrders,
      byStatus: {
        pending: pendingOrders,
        processing: processingOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
      totalRevenue: totalRevenue._sum.totalAmount || 0,
    };
  }
}
