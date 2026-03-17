/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { EventsService } from './events/events.service';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { OrderStatus, PaymentStatus, FulfillmentStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StatusUtils } from './utils/status.utils';
import { NumberUtils } from './utils/number.utils';

export interface ExportFilters {
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
}

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
  async updateStatus(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
    user: any,
  ) {
    const { status, reason } = updateStatusDto;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    // 2. Validar permisos según el rol
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      throw new ForbiddenException('No tienes permiso para modificar esta orden');
    }

    // 3. Validar que el estado nuevo sea diferente
    if (order.status === status) {
      throw new BadRequestException(`La orden ya está en estado ${status}`);
    }

    // 4. Validar transición de estado permitida
    this.validateStatusTransition(order.status, status, user.role);

    // 5. Actualizar la orden
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Actualizar la orden
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          ...(status === OrderStatus.CANCELLED && { cancelledAt: new Date() }),
          ...(status === OrderStatus.DELIVERED && { deliveredAt: new Date() }),
        },
        include: {
          items: true,
        },
      });

      // Registrar en historial de cambios
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          reason: reason || `Cambio realizado por ${user.role}: ${user.id}`,
          status,
        },
      });

      return updated;
    });

    this.logger.log(`✅ Orden ${orderId} actualizada: ${order.status} → ${status}`);

    return updatedOrder;
  }
  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
    userRole: string,
  ) {
    // Matriz de transiciones permitidas
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED], // 👈 Estaba faltando
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    // Verificar si la transición está permitida
    const allowed = allowedTransitions[currentStatus]?.includes(newStatus);

    if (!allowed) {
      // Los admins pueden forzar ciertos cambios
      if (userRole === 'ADMIN' && this.isAdminForcedTransition(currentStatus, newStatus)) {
        this.logger.warn(`⚠️ Admin forzando transición: ${currentStatus} → ${newStatus}`);
        return;
      }

      throw new BadRequestException(
        `No se puede cambiar de ${currentStatus} a ${newStatus}`,
      );
    }
  }
  private isAdminForcedTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): boolean {
    const adminForcedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
      ],
      [OrderStatus.CONFIRMED]: [
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.CANCELLED,
      ], // 👈 AGREGADO
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    return adminForcedTransitions[currentStatus]?.includes(newStatus) || false;
  }
  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException(
        'No puedes cancelar órdenes de otro usuario',
      );
    }

    const allowedStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
    ];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `No se puede cancelar una orden en estado ${order.status}`,
      );
    }

    return this.updateStatus(
      orderId,
      {
        status: OrderStatus.CANCELLED,
        reason: reason || 'Cancelado por el usuario',
      },
      { id: userId, role: 'USER' },
    );
  }
  async deleteOrder(id: string) {
    this.logger.log(`🗑️ Eliminando orden: ${id}`);

    const order = await this.findOne(id);
    await this.prisma.order.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
    this.logger.log(`✅ Orden ${id} eliminada (soft delete)`);
    return { deleted: true, id };
  }
  async getOrderHistory(id: string, user: any) {
    this.logger.log(`📜 Obteniendo historial de orden: ${id}`);

    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      throw new ForbiddenException('No tienes permiso para ver este historial');
    }

    return this.prisma.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
  async updateShippingAddress(id: string, addressDto: any, user: any) {
    this.logger.log(`📦 Actualizando dirección de envío: ${id}`);

    const order = await this.findOne(id);
    if (
      !StatusUtils.isStatusAllowed(
        order.status,
        StatusUtils.CANCELLABLE_STATUSES,
      )
    ) {
      throw new BadRequestException(
        `No se puede modificar una orden en estado ${order.status}`,
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { shippingAddress: addressDto },
      include: { items: true },
    });
  }
  async addItems(id: string, items: OrderItemDto[], user: any) {
    this.logger.log(`➕ Agregando ${items.length} items a orden: ${id}`);

    const order = await this.findOne(id);
    if (
      !StatusUtils.isStatusAllowed(
        order.status,
        StatusUtils.CANCELLABLE_STATUSES,
      )
    ) {
      throw new BadRequestException(
        `No se puede modificar una orden en estado ${order.status}`,
      );
    }
    // Agregar items y recalcular totales
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const unitPrice = NumberUtils.toNumber(item.unitPrice);
        const subtotal = unitPrice * item.quantity;
        await tx.orderItem.create({
          data: {
            orderId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: subtotal,
            productSnapshot: item.productSnapshot || {},
          },
        });
      }

      // Recalcular totales
      const updatedOrder = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!updatedOrder) {
        throw new NotFoundException(
          'Orden no encontrada después de actualizar',
        );
      }
      const newSubtotal = NumberUtils.calculateSubtotal(updatedOrder.items);

      const newTotal = newSubtotal;

      return tx.order.update({
        where: { id },
        data: {
          subtotal: newSubtotal,
          totalAmount: newTotal,
        },
        include: { items: true },
      });
    });
  }
  async removeItem(orderId: string, itemId: string, user: any) {
    this.logger.log(`➖ Eliminando item ${itemId} de orden: ${orderId}`);

    const order = await this.findOne(orderId);

    if (order.userId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta orden',
      );
    }
    if (
      !StatusUtils.isStatusAllowed(
        order.status,
        StatusUtils.CANCELLABLE_STATUSES,
      )
    ) {
      throw new BadRequestException(
        `No se puede modificar una orden en estado ${order.status}`,
      );
    }

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });

      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (updatedOrder == null) {
        throw new NotFoundException(
          'Orden no encontrada después de actualizar',
        );
      }
      const newSubtotal = NumberUtils.calculateSubtotal(updatedOrder.items);
      const newTotal = newSubtotal;

      return tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          totalAmount: newTotal,
        },
        include: { items: true },
      });
    });
  }
  async getOrdersByDateRange(startDate: Date, endDate: Date) {
    this.logger.log(`📅 Buscando órdenes entre ${startDate} y ${endDate}`);

    return this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
  async exportToCsv(filters: ExportFilters): Promise<string> {
    this.logger.log(`📊 Exportando órdenes a CSV con filtros:`, filters);

    try {
      const csvRows: string[] = [];
      // Construir filtros para la consulta
      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.createdAt.lte = new Date(filters.endDate);
        }
      }

      // Obtener órdenes con sus items
      const orders = await this.prisma.order.findMany({
        where,
        include: {
          items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      this.logger.log(`✅ ${orders.length} órdenes encontradas para exportar`);

      if (orders.length === 0) {
        return this.getEmptyCsv();
      }

      // 1. Encabezados
      csvRows.push(this.getCsvHeaders());

      // 2. Datos de las órdenes
      for (const order of orders) {
        const orderRows = this.orderToCsvRows(order);
        csvRows.push(...orderRows);
      }

      // 3. Fila de totales
      csvRows.push(this.getTotalsRow(orders));

      return csvRows.join('\n');
    } catch (error) {
      this.logger.error(
        `❌ Error exportando a CSV: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Error generando archivo CSV');
    }
  }
  private getCsvHeaders(): string {
    const headers = [
      'Número de Orden',
      'Fecha',
      'Cliente ID',
      'Cliente Email',
      'Estado',
      'Producto ID',
      'Producto Nombre',
      'Cantidad',
      'Precio Unitario',
      'Subtotal Item',
      'Subtotal Orden',
      'Impuesto',
      'Envío',
      'Descuento',
      'Total',
      'Dirección Envío',
      'Notas',
    ];

    return headers.join(',');
  }
  private orderToCsvRows(order: any): string[] {
    const rows: string[] = [];
    const date = new Date(order.createdAt).toLocaleDateString('es-AR');

    // Escapar campos que puedan contener comas
    const shippingAddress = this.escapeCsvField(
      `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.zipCode}, ${order.shippingAddress.country}`
    );

    const notes = this.escapeCsvField(order.notes || '');

    // Por cada item, crear una fila
    for (const item of order.items) {
      const row = [
        order.orderNumber,
        date,
        order.userId,
        order.userEmail || '',
        order.status,
        item.productId,
        this.escapeCsvField(item.productName || ''),
        item.quantity,
        item.unitPrice.toFixed(2),
        (item.quantity * item.unitPrice).toFixed(2),
        order.subtotal.toFixed(2),
        order.taxAmount?.toFixed(2) || '0.00',
        order.shippingAmount?.toFixed(2) || '0.00',
        order.discountAmount?.toFixed(2) || '0.00',
        order.total.toFixed(2),
        shippingAddress,
        notes,
      ];

      rows.push(row.join(','));
    }

    // Si la orden no tiene items, crear una fila sin items
    if (order.items.length === 0) {
      const row = [
        order.orderNumber,
        date,
        order.userId,
        order.userEmail || '',
        order.status,
        'SIN ITEMS',
        '',
        '',
        '',
        '',
        order.subtotal.toFixed(2),
        order.taxAmount?.toFixed(2) || '0.00',
        order.shippingAmount?.toFixed(2) || '0.00',
        order.discountAmount?.toFixed(2) || '0.00',
        order.total.toFixed(2),
        shippingAddress,
        notes,
      ];

      rows.push(row.join(','));
    }

    return rows;
  }
  private getTotalsRow(orders: any[]): string {
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => sum + order.items.length, 0);
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalTax = orders.reduce((sum, order) => sum + (order.taxAmount || 0), 0);
    const totalShipping = orders.reduce((sum, order) => sum + (order.shippingAmount || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);

    return [
      'TOTALES',
      '',
      '',
      '',
      '',
      '',
      '',
      totalItems,
      '',
      '',
      '',
      totalTax.toFixed(2),
      totalShipping.toFixed(2),
      totalDiscount.toFixed(2),
      totalRevenue.toFixed(2),
      `Total Órdenes: ${totalOrders}`,
      '',
    ].join(',');
  }
  private getEmptyCsv(): string {
    const headers = this.getCsvHeaders();
    const message = this.escapeCsvField('No se encontraron órdenes para los filtros seleccionados');
    return `${headers}\n"${message}"`;
  }
  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      // Reemplazar comillas dobles por dos comillas dobles
      const escaped = field.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    return field;
  }
  async updatePaymentStatus(
    orderId: string,
    paymentData: {
      paymentId: string;
      paymentStatus: string;
      paymentDate: Date;
    },
  ) {
    this.logger.log(
      `💳 Actualizando estado de pago de orden ${orderId} a ${paymentData.paymentStatus}`,
    );
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true, // Incluir los pagos relacionados
        items: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }
    const hasExistingPayment = order.payments?.some((payment) => {
      console.log('Payment status:', payment.status);
      return payment.status === 'PAID';
    });

    if (hasExistingPayment) {
      this.logger.log('⏭️ Pago Realizado - ignorando');
      const data = { order, message: '⏭️ Pago Realizado - ignorando' };
      return data;
    }
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentId: paymentData.paymentId,
          paymentStatus: paymentData.paymentStatus,
          paymentDate: paymentData.paymentDate,
          ...(paymentData.paymentStatus === 'PAID' && {
            status: OrderStatus.CONFIRMED,
          }),
        },
        include: {
          items: true,
        },
      });

      // Registrar en el historial
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status:
            paymentData.paymentStatus === 'PAID'
              ? OrderStatus.CONFIRMED
              : order.status,
          reason: `Pago ${paymentData.paymentStatus === 'PAID' ? 'aprobado' : paymentData.paymentStatus}`,
        },
      });
      if (paymentData.paymentStatus === 'PAID') {
        await tx.payment.create({
          data: {
            orderId,
            amount: order.totalAmount,
            status: 'PAID',
            paymentMethod: 'Visa',
          },
        });
      }

      return updated;
    });

    this.logger.log(
      `✅ Pago actualizado para orden ${orderId}: ${paymentData.paymentStatus}`,
    );
    return updatedOrder;
  }
  async getOrderById(@Payload() data: { orderId: string }) {
    this.logger.log(`📨 Recibida solicitud de orden: ${data.orderId}`);
    try {
      const order = await this.findOne(data.orderId);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        total: order.totalAmount,
        status: order.status,
      };
    } catch (error) {
      this.logger.error(`❌ Error obteniendo orden: ${error.message}`);
      return {
        success: false,
        error: 'Orden no encontrada',
      };
    }
  }
}
