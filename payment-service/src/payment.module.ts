import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderRabbitClient } from './rabbit/order.rabbit.client';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'order_requests', // Misma cola que usa order-service
          queueOptions: {
            durable: true,
          },
          persistent: true,
          noAck: true,
        },
      },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, OrderRabbitClient],
  exports: [OrderRabbitClient],
})
export class PaymentModule {}
