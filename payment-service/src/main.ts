import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { PaymentModule } from './payment.module';
import { config } from 'dotenv';

async function bootstrap() {
  config();
  const app = await NestFactory.create(PaymentModule);
  await app.listen(process.env.PORT ?? 3004);
  Logger.log(`payment service running on port ${process.env.PORT}`);
}

bootstrap();
