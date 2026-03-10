import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { UserController } from './user.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from 'src/email/email.module';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { RabbitModule } from './user.rabit.module';

@Module({
  imports: [
    RedisModule,
    PassportModule,
    RabbitModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
    ClientsModule.register([
      {
        name: 'PRODUCT_SERVICE', // Para comunicarse con product-service
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
          queue: 'product_service_queue',
          queueOptions: {
            durable: false,
          },
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
    AuthModule,
    EmailModule,
  ],
  controllers: [UserController, AuthController],
  providers: [
    UserService,
    UserRepository,
    AuthService,
    PrismaService,
    JwtStrategy,
  ],
  exports: [UserService, EmailModule],
})
export class UserModule {}
