// payment-service/src/rabbit/order-rabbit.client.ts
import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  lastValueFrom,
  timeout,
  catchError,
  throwError,
  TimeoutError,
} from 'rxjs';

@Injectable()
export class OrderRabbitClient implements OnModuleInit {
  private readonly logger = new Logger(OrderRabbitClient.name);
  private readonly timeoutMs = 5000;
  private isConnected = false;

  constructor(@Inject('ORDER_SERVICE') private readonly client: ClientProxy) {}

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(retries = 5) {
    for (let i = 1; i <= retries; i++) {
      try {
        this.logger.log(`🔄 Intento ${i}/${retries} de conectar a Order Service...`);
        await this.client.connect();
        this.isConnected = true;
        this.logger.log('✅ Conectado a Order Service vía RabbitMQ');
        return;
      } catch (error) {
        this.logger.error(`❌ Error conectando (intento ${i}/${retries}):`, error.message);
        if (i === retries) {
          this.logger.error('❌ No se pudo conectar a Order Service después de varios intentos');
        } else {
          await this.delay(2000 * i); // Espera progresiva
        }
      }
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async onApplicationBootstrap() {
    await this.client.connect();
    this.logger.log('✅ Conectado a RabbitMQ');
  }

  async validateUser(userId: string): Promise<any> {
    try {
      this.logger.log(`🔍 Solicitando validación de usuario: ${userId}`);
      const response = await lastValueFrom(
        this.client.send('user.validate', { userId }).pipe(
          timeout(this.timeoutMs),
          catchError((err) => {
            if (err instanceof TimeoutError) {
              return throwError(
                () => new Error('Timeout en respuesta de user-service'),
              );
            }
            return throwError(() => err);
          }),
        ),
      );
      if (!response || !response.data) {
        throw new Error('Respuesta inválida de user-service');
      }

      this.logger.log(`✅ Usuario validado: ${userId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Error validando usuario ${userId}:`, error.message);
      throw error;
    }
  }

  async getUserPermissions(userId: string): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.client
          .send('user.permissions', { userId })
          .pipe(timeout(this.timeoutMs)),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo permisos: ${userId}`,
        error.message
      );
      throw error;
    }
  }

  async batchValidateUsers(userIds: string[]): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.client
          .send('user.batch.validate', { userIds })
          .pipe(timeout(this.timeoutMs * 2)), // Más tiempo para batch
      );

      return response.data;
    } catch (error) {
      this.logger.error(`❌ Error validando usuarios en batch:`, error.message);
      throw error;
    }
  }
}
