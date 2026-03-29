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
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'user_rpc_queue',
          queueOptions: {
            durable: true,
          },
          noAck: true,
        },
      },
      {
        name: 'PRODUCT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'product_rpc_queue',
          queueOptions: {
            durable: true,
          },
          noAck: true,
        },
      },
    ]),
  ],
  providers: [
    OrderService,
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
