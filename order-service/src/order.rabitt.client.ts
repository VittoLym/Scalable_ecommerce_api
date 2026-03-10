/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout, catchError, throwError } from 'rxjs';
import { TimeoutError } from 'rxjs';

@Injectable()
export class OrderRabbitClient {
  private readonly logger = new Logger(OrderRabbitClient.name);
  private readonly timeoutMs = 5000; // 5 segundos de timeout

  constructor(@Inject('USER_SERVICE') private readonly client: ClientProxy) {}

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
