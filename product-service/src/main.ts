import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ProductModule } from './product/product.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ProductModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'product_rpc_queue', // Cola para eventos
      queueOptions: {
        durable: true,
      },
      noAck: true,
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3002);
  Logger.log(`Product service running on port ${process.env.PORT}`);
}
bootstrap();
