import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar microservicio RabbitMQ
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'order_service_queue',
      queueOptions: {
        durable: false,
      },
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