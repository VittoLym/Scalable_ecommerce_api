// auth/auth.module.ts
import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AdminGuard } from './guards/admin.guard';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
          queue: 'user_requests',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  providers: [AdminGuard],
  exports: [AdminGuard, ClientsModule],
})
export class AuthModule {}
