import { NestFactory } from '@nestjs/core';
import { ProductModule } from './product/product.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ProductModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
      queue: 'product_service_queue',
      queueOptions: {
        durable: false,
      },
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
  await app.listen(process.env.PORT ?? 3005);
  console.log(`Product service running on port ${process.env.PORT}`);
}
bootstrap();
