import { NestFactory } from '@nestjs/core';
import { UserModule } from './modules/user/user.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllExceptionsFilter } from '../src/common/filters/http-expetions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response-interceptos';

async function bootstrap() {
  const app = await NestFactory.create(UserModule);
  const rabbitmqHost =
    process.env.NODE_ENV === 'production' ? 'rabbitmq' : 'localhost';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${rabbitmqHost}:5672`],
      queue: 'user_service_queue',
      queueOptions: {
        durable: false,
      },
    },
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableCors();
  await app.startAllMicroservices();
  await app.listen(3001);
  console.log('User service running on port 3001');
}
bootstrap();
