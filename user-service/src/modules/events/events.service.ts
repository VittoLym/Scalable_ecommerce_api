import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class EventsService {
  constructor(@Inject('ORDER_SERVICE') private readonly client: ClientProxy) {}

  emitEvent(pattern: string, data: any) {
    console.log(`📤 Emitiendo evento desde user-service: ${pattern}`);
    this.client.emit(pattern, data);
  }

  sendCommand(pattern: string, data: any) {
    return this.client.send(pattern, data);
  }
}
