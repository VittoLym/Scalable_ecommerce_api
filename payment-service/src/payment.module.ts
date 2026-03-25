import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderRabbitClient } from './rabbit/order.rabbit.client';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Opcional: hace que ConfigModule sea global
    }),
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'order_rpc_queue', // 👈 MISMA COLA
          queueOptions: { durable: true },
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
