import { NestFactory } from '@nestjs/core';
import { OrderModule } from './order.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost'],
      queue: 'order_service_queue',
      queueOptions: {
        durable: false,
      },
    },
  });
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost'],
      queue: 'user_requests',
      queueOptions: {
        durable: true,
      },
      noAck: false,
      persistent: true,
    },
  });
  app.enableCors();
  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3003);
  Logger.log(
    `🚀 Order service running on port ${process.env.PORT || 3003}`,
    'Bootstrap',
  );
}
bootstrap();
