import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class EventsService {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
  ) {}

  /**
   * Emitir un evento (fire and forget)
   */
  emitEvent(pattern: string, data: any) {
    console.log(`📤 [product-service] Emitiendo evento: ${pattern}`, data);
    this.client.emit(pattern, data);
  }

  /**
   * Enviar comando y esperar respuesta
   */
  sendCommand(pattern: string, data: any) {
    console.log(`📤 [product-service] Enviando comando: ${pattern}`, data);
    return this.client.send(pattern, data);
  }
}
