import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class EventsService {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
  ) {}

  // Emitir eventos (no espera respuesta)
  emitEvent(pattern: string, data: any) {
    console.log(`Emitting event: ${pattern}`, data);
    this.client.emit(pattern, data);
  }

  // Enviar comandos (espera respuesta)
  sendCommand(pattern: string, data: any) {
    console.log(`Sending command: ${pattern}`, data);
    return this.client.send(pattern, data);
  }
}
