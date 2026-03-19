import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  await app.listen(process.env.PORT || 3000);
  Logger.log(
    `🚀 Gateway service running on port ${process.env.PORT || 3000}`,
    'Bootstrap',
  );
}
bootstrap();
