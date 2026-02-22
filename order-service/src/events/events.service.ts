import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Connected to RabbitMQ');
  }

  async emitEvent(pattern: string, data: any) {
    this.logger.log(`📤 Emitting event: ${pattern}`, data);
    return this.client.emit(pattern, data);
  }

  async sendCommand(pattern: string, data: any) {
    this.logger.log(`📤 Sending command: ${pattern}`, data);
    return lastValueFrom(this.client.send(pattern, data));
  }
}
