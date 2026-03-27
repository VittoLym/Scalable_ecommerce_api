import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @Inject('PRODUCT_SERVICE') private readonly clientProduct: ClientProxy,
    @Inject('PAYMENT_SERVICE') private readonly clientPayment: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.clientProduct.connect();
    await this.clientPayment.connect();
    this.logger.log('Connected to RabbitMQ');
  }

  async emitEvent(pattern: string, data: any) {
    console.log(pattern, data);
    const test = await this.clientPayment.send(pattern, data).toPromise();
    console.log(test);
  }

  async sendCommand(pattern: string, data: any) {
    return await this.clientProduct.send(pattern, data).toPromise();
  }
}
