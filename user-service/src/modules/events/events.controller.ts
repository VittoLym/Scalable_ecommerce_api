import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class EventsController {
  constructor() {}

  @EventPattern('product.created')
  async handleProductCreated(@Payload() data: any) {
    console.log('📦 Evento recibido - Producto creado:', data);
    // Aquí puedes: actualizar caché, enviar notificación, etc.
    // Por ejemplo, guardar en base de datos que hay un nuevo producto
  }

  @EventPattern('order.created')
  async handleOrderCreated(@Payload() data: any) {
    console.log('📦 Evento recibido - Orden creada:', data);
    // Si el user-service necesita saber de órdenes
  }

  @EventPattern('test.event')
  async handleTestEvent(@Payload() data: any) {
    console.log('🧪 Evento de prueba recibido:', data);
  }
}
