import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrderRabbitClient } from '../order.rabitt.client';

@Injectable()
export class AuthUserGuard implements CanActivate {
  private readonly logger = new Logger(AuthUserGuard.name);

  constructor(
    private reflector: Reflector,
    private rabbitClient: OrderRabbitClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Verificar si la ruta es pública
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }

    try {
      // Obtener token del header
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedException('Token no proporcionado');
      }

      // Extraer userId del token (simplificado - aquí deberías decodificar el JWT)
      // Por ahora, asumimos que el token es el userId (SOLO PARA PRUEBAS)
      const userId = authHeader.replace('Bearer ', '');
      if (!userId) {
        throw new UnauthorizedException('Usuario no identificado');
      }

      // Validar usuario con RabbitMQ
      const user = await this.rabbitClient.validateUser(userId);
      if (!user) {
        throw new UnauthorizedException('Usuario no válido');
      }

      // 📌 IMPORTANTE: Adjuntar usuario al request
      request.user = user;
      this.logger.log(`✅ Usuario autenticado: ${user.id} - Rol: ${user.role}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Error en autenticación: ${error.message}`);
      throw new UnauthorizedException('Error de autenticación');
    }
  }
}
