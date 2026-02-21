import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

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
}