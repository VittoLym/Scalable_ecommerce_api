import { Controller } from '@nestjs/common';
import { Payload, MessagePattern, EventPattern } from '@nestjs/microservices';

@Controller()
export class EventsController {
  constructor() {}

  @EventPattern('user.created')
  async handleUserCreated(@Payload() data: any) {
    console.log('👤 Evento recibido - Usuario creado:', data);
    // Product service puede: crear carrito, wishlist, etc.
  }

  @EventPattern('user.deleted')
  async handleUserDeleted(@Payload() data: any) {
    console.log('👤 Evento recibido - Usuario eliminado:', data);
    // Limpiar datos relacionados (wishlist, carrito, etc.)
  }
  @MessagePattern('inventory.check')
  async handleInventoryCheck(pattern: string, @Payload() data: any) {
    console.log('👤 Evento recibido - Chequeando inventario:', data, pattern);
    // Limpiar datos relacionados (wishlist, carrito, etc.)
    return 'okay con papas';
  }
}
