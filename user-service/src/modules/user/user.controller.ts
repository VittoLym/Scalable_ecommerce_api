import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
  Inject,
} from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/user-register.dto';
import { UserResponseDto } from './dto/user-response.dto';
import type { Request } from 'express';
import { RedisService } from '../redis/redis.service';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject('PRODUCT_SERVICE') private productClient: ClientProxy, // Opcional: para comunicarse con order-service
    private readonly redisService: RedisService,
  ) {}
  @Get()
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    const healthStatus = {
      status: 'ok',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      dependencies: {
        database: 'unknown',
        rabbitmq: 'unknown',
        redis: 'unknown',
      },
    };
    try {
      await this.userService.checkDatabaseConnection();
      healthStatus.dependencies.database = 'connected';
    } catch (error) {
      console.log(error, '.');
      healthStatus.dependencies.database = 'disconnected';
      healthStatus.status = 'degraded';
    }
    try {
      if (this.productClient) {
        console.log('📤 Enviando ping a product-service...');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('RabbitMQ timeout')), 3000),
        );
        const pingPromise = this.productClient
          .send('ping', { from: 'user-service', timestamp: Date.now() })
          .toPromise();
        const result = await Promise.race([pingPromise, timeoutPromise]);
        if (result && result.pong) {
          console.log('✅ Ping exitoso a product-service');
          healthStatus.dependencies.rabbitmq = 'connected';
        } else {
          healthStatus.dependencies.rabbitmq = 'error';
          healthStatus.status = 'degraded';
        }
      } else {
        healthStatus.dependencies.rabbitmq = 'not_configured';
      }
    } catch (error) {
      console.error('❌ RabbitMQ error:', error.message);
      healthStatus.dependencies.rabbitmq = 'disconnected';
      healthStatus.status = 'degraded';
    }
    try {
      const pingResult = await this.redisService.ping();
      healthStatus.dependencies.redis = pingResult ? 'connected' : 'error';
    } catch (error) {
      healthStatus.dependencies.redis = 'disconnected';
      healthStatus.status = 'degraded';
    }

    return healthStatus;
  }
  @Get('redis-test')
  async testRedis() {
    try {
      const testJti = 'test-token-123';
      await this.redisService.blacklistToken(testJti, 60); // Expira en 60 segundos
      const isBlacklisted = await this.redisService.isBlacklisted(testJti);
      return {
        message: 'Redis funcionando!',
        test: {
          token: testJti,
          isBlacklisted: isBlacklisted,
        },
      };
    } catch (error) {
      return {
        error: 'Error conectando a Redis',
        details: error.message,
      };
    }
  }
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerUserDto: RegisterUserDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const user = await this.userService.register(
      registerUserDto,
      ip,
      userAgent,
    );
    return user;
  }
  @Get(':id')
  async findById(@Param('id') id: string): Promise<any> {
    return this.userService.findById(id);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string): Promise<void> {
    await this.userService.softDelete(id);
  }
  @MessagePattern('ping')
  handlePing(@Payload() data: any) {
    console.log('📡 Ping recibido en product-service desde:', data?.from);
    return {
      pong: true,
      timestamp: new Date().toISOString(),
      service: 'product-service',
      receivedFrom: data?.from || 'pikiblainder'
    };
  }
  @MessagePattern('get_user_by_id')
  async handleGetUserById(@Payload() data: { userId: string }) {
    try {
      const user = await this.userService.findById(data.userId);
      return {
        success: true,
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handler para validar múltiples usuarios (útil para order-service)
   */
  @MessagePattern('validate_users')
  async handleValidateUsers(@Payload() data: { userIds: string[] }) {
    try {
      const users = await Promise.all(
        data.userIds.map(async (userId) => {
          try {
            const user = await this.userService.findById(userId);
            return {
              userId,
              exists: true,
              user: user,
            };
          } catch {
            return {
              userId,
              exists: false,
            };
          }
        }),
      );

      return {
        success: true,
        data: users,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handler para obtener perfil básico de usuario (información limitada)
   */
  @MessagePattern('get_user_profile')
  async handleGetUserProfile(@Payload() data: { userId: string }) {
    try {
      const user = await this.userService.findById(data.userId);
      // Devolver solo información relevante para otros servicios
      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          fullName: user.profile?.fullName,
          role: user.role,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handler para verificar si un usuario existe
   */
  @MessagePattern('user_exists')
  async handleUserExists(@Payload() data: { userId: string }) {
    try {
      await this.userService.findById(data.userId);
      return {
        success: true,
        data: {
          exists: true,
          userId: data.userId,
        },
      };
    } catch {
      return {
        success: true,
        data: {
          exists: false,
          userId: data.userId,
        },
      };
    }
  }

  /**
   * Handler para actualizar último inicio de sesión
   */
  @MessagePattern('user_updated_login')
  async handleUserLogin(@Payload() data: { userId: string; ip?: string }) {
    try {
      return {
        success: true,
        message: 'Login recorded',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
