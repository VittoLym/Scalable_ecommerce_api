// order.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from '@prisma/client';
import { Public } from 'decorator/public.decorator';
import { Roles } from 'decorator/role.decorator';
import { User } from 'decorator/user.decorator';
import { AddressDto } from './dto/create-order.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);
  constructor(private readonly orderService: OrderService) {}
  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto, @User() user: any) {
    this.logger.log(`📝 Creando orden para usuario: ${user.id}`);
    createOrderDto.userId = user.id;
    createOrderDto.userEmail = user.email;
    const order = await this.orderService.create(createOrderDto);
    return {
      success: true,
      message: 'Orden creada exitosamente',
      data: order,
    };
  }
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('status') status?: OrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    this.logger.log(`📋 Listando órdenes - Status: ${status || 'todos'}`);
    const result = await this.orderService.findAll(status, page, limit);
    return {
      success: true,
      message: 'Órdenes obtenidas exitosamente',
      ...result,
    };
  }
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats() {
    this.logger.log('📊 Obteniendo estadísticas de órdenes');
    const stats = await this.orderService.getStats();
    return {
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      data: stats,
    };
  }
  @Get('number/:orderNumber')
  @HttpCode(HttpStatus.OK)
  async findByOrderNumber(@Param('orderNumber') orderNumber: string) {
    this.logger.log(`🔍 Buscando orden por número: ${orderNumber}`);
    const order = await this.orderService.findByOrderNumber(orderNumber);
    return {
      success: true,
      message: 'Orden encontrada',
      data: order,
    };
  }
  @Get('my-orders')
  @HttpCode(HttpStatus.OK)
  async findMyOrders(@User() user: any, @Query('status') status?: OrderStatus) {
    this.logger.log(`👤 Obteniendo órdenes del usuario: ${user}`);
    const orders = await this.orderService.findByUser(user.id);
    return {
      success: true,
      message: 'Tus órdenes obtenidas exitosamente',
      data: orders,
    };
  }
  @Get('user/:userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('status') status?: OrderStatus,
  ) {
    this.logger.log(`🔍 Obteniendo órdenes del usuario: ${userId}`);
    const orders = await this.orderService.findByUser(userId);
    return {
      success: true,
      message: 'Órdenes del usuario obtenidas exitosamente',
      data: orders,
    };
  }
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    this.logger.log(`🔍 Buscando orden: ${id}`);
    const order = await this.orderService.findOne(id);
    if (order.userId !== user.id && user.role !== 'ADMIN') {
      return {
        success: false,
        message: 'No tienes permiso para ver esta orden',
        statusCode: HttpStatus.FORBIDDEN,
      };
    }
    return {
      success: true,
      message: 'Orden encontrada',
      data: order,
    };
  }
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async deleteOrder(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`🗑️ Eliminando orden: ${id}`);
    const result = await this.orderService.deleteOrder(id);
    return {
      success: true,
      message: 'Orden eliminada correctamente',
      data: result,
    };
  }
  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  async processPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() paymentData: any,
  ) {
    this.logger.log(`💰 Procesando pago para orden: ${id}`);
    const order = await this.orderService.processPayment(id, paymentData);
    return {
      success: true,
      message: 'Pago procesado exitosamente',
      data: order,
    };
  }
  @Post(':id/fulfillment')
  @HttpCode(HttpStatus.OK)
  async updateFulfillment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() fulfillmentData: any,
  ) {
    this.logger.log(`📦 Actualizando fulfillment para orden: ${id}`);
    const fulfillment = await this.orderService.updateFulfillment(id, fulfillmentData);
    return {
      success: true,
      message: 'Fulfillment actualizado exitosamente',
      data: fulfillment,
    };
  }
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: any,
    @Body('reason') reason: string,
  ) {
    this.logger.log(`❌ Cancelando orden: ${id} - Usuario: ${user.id}`);
    const order = await this.orderService.findOne(id);
    // Verificar que sea el propietario
    if (order.userId !== user.id) {
      return {
        success: false,
        message: 'No tienes permiso para cancelar esta orden',
        statusCode: HttpStatus.FORBIDDEN,
      };
    }
    // Solo se pueden cancelar órdenes pendientes
    if (order.status !== OrderStatus.PENDING) {
      return {
        success: false,
        message: `No se puede cancelar una orden en estado ${order.status}`,
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }
    const cancelledOrder = await this.orderService.rejectOrder(id, reason || 'Cancelado por el usuario');
    return {
      success: true,
      message: 'Orden cancelada exitosamente',
      data: cancelledOrder,
    };
  }
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    this.logger.log(`⚠️ Rechazando orden: ${id} - Razón: ${reason}`);
    const order = await this.orderService.rejectOrder(id, reason);
    return {
      success: true,
      message: 'Orden rechazada exitosamente',
      data: order,
    };
  }
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  async refundOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    this.logger.log(`💸 Procesando reembolso para orden: ${id}`);
    const order = await this.orderService.refundOrder(id, reason);
    return {
      success: true,
      message: 'Reembolso procesado exitosamente',
      data: order,
    };
  }
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @User() user: any,
  ) {
    this.logger.log(
      `🔄 Actualizando estado de orden: ${id} a ${updateStatusDto.status}`,
    );
    const dat = await this.orderService.updateStatus(id, updateStatusDto, user);
    return {
      success: true,
      message: 'Estado actualizado exitosamente',
      data: dat,
    };
  }
  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  async getOrderHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: any,
  ) {
    this.logger.log(`📜 Obteniendo historial de orden: ${id}`);
    const history = await this.orderService.getOrderHistory(id, user);
    return {
      success: true,
      message: 'Historial obtenido exitosamente',
      data: history,
    };
  }
  @Post(':id/items')
  @HttpCode(HttpStatus.OK)
  async addItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() itemsDto: { items: OrderItemDto[] },
    @User() user: any,
  ) {
    this.logger.log(`➕ Agregando items a orden: ${id}`);
    const order = await this.orderService.addItems(id, itemsDto.items, user);
    return {
      success: true,
      message: 'Items agregados exitosamente',
      data: order,
    };
  }
  @Patch(':id/shipping-address')
  @HttpCode(HttpStatus.OK)
  async updateShippingAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addressDto: AddressDto,
    @User() user: any,
  ) {
    this.logger.log(`📦 Actualizando dirección de envío: ${id}`);
    const order = await this.orderService.updateShippingAddress(id, addressDto, user);
    return {
      success: true,
      message: 'Dirección actualizada exitosamente',
      data: order,
    };
  }
  @Delete(':orderId/items/:itemId')
  @HttpCode(HttpStatus.OK)
  async removeItem(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @User() user: any,
  ) {
    this.logger.log(`➖ Eliminando item ${itemId} de orden: ${orderId}`);
    const order = await this.orderService.removeItem(orderId, itemId, user);
    return {
      success: true,
      message: 'Item eliminado exitosamente',
      data: order,
    };
  }
  @Get('analytics/by-date')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async getOrdersByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    this.logger.log(`📅 Órdenes entre ${startDate} y ${endDate}`);
    const orders = await this.orderService.getOrdersByDateRange(
      new Date(startDate),
      new Date(endDate),
    );
    return {
      success: true,
      data: orders,
    };
  }
  @Get('health/check')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return {
      success: true,
      message: 'Order service is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
  @Get('export/csv')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async exportToCsv(
    @Query('status') status?: OrderStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.log(`📊 Exportando órdenes a CSV`);
    const csvData = await this.orderService.exportToCsv({ status, startDate, endDate });
    return {
      success: true,
      data: csvData,
    };
  }
  @MessagePattern('order.get_by_id')
  async getOrderById(@Payload() data: { orderId: string }) {
    try {
      const order = await this.orderService.findOne(data.orderId);
      return {
        success: true,
        data: order,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @MessagePattern('order.update_payment_status')
  async updatePaymentStatus(
    @Payload()
    data: {
      orderId: string;
      paymentId: string;
      paymentStatus: string;
      paymentDate: Date;
    },
  ) {
    try {
      const order = await this.orderService.updatePaymentStatus(
        data.orderId,
        data,
      );
      return {
        success: true,
        data: order,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
