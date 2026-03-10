import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { RolesGuard } from './guards/role.guard';
import { AuthUserGuard } from './guards/auth-user.guard';
import { OrderRabbitClient } from './order.rabitt.client';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    EventsModule,
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [`${process.env.RABBITMQ_URL!}`],
          queue: 'order_queue',
          queueOptions: { durable: false },
        },
      },
      {
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'user_requests',
          queueOptions: {
            durable: true,
            // Configuración importante para evitar el error
            autoDelete: false,
            arguments: {
              'x-queue-type': 'classic',
            },
          },
          // Configuración de la cola de respuestas
          replyQueue: 'amq.rabbitmq.reply-to', // Usar reply-to queue de RabbitMQ
          persistent: true,
          noAck: true,
          prefetchCount: 1, // Procesar un mensaje a la vez
        },
      },
    ]),
  ],
  providers: [
    OrderService,
    RolesGuard,
    AuthUserGuard,
    OrderRabbitClient,
    {
      provide: APP_GUARD,
      useClass: AuthUserGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
