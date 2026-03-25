import { NestFactory } from '@nestjs/core';
import { UserModule } from './modules/user/user.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllExceptionsFilter } from '../src/common/filters/http-expetions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response-interceptos';
import cookieParser from 'cookie-parser';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(UserModule);
  app.use(cookieParser());
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'user_rpc_queue', // 🔥 única cola del servicio
      queueOptions: {
        durable: true,
      },
      noAck: true, // 🔥 permite control (eventos + RPC)
    },
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableCors();
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3001);
  Logger.log(`User service running on port ${process.env.PORT}`);
}
bootstrap();
