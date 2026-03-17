import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { PaymentModule } from './payment.module';
import { config } from 'dotenv';
import { MicroserviceOptions } from '@nestjs/microservices/interfaces';
import { Transport } from '@nestjs/microservices';
import maintest from './utils/mercadopago.utils';

async function bootstrap() {
  config();
  const app = await NestFactory.create(PaymentModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'order_service_queue', // 👈 MISMA COLA QUE EN PAYMENT
      queueOptions: {
        durable: false,
      },
    },
  });
  await app.listen(process.env.PORT ?? 3004);
  Logger.log(`payment service running on port ${process.env.PORT}`);
}

bootstrap();
