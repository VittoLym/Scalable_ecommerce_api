import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(@Inject('EVENT_BUS') private readonly client: ClientProxy) {}

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Connected to RabbitMQ');
  }

  async emitEvent(pattern: string, data: any) {
    return this.client.emit(pattern, data);
  }

  async sendCommand(pattern: string, data: any) {
    return lastValueFrom(this.client.send(pattern, data));
  }
}
