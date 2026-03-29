import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrderRabbitClient } from '../order.rabitt.client';
import { IS_PUBLIC_KEY } from 'decorator/public.decorator';

@Injectable()
export class AuthUserGuard implements CanActivate {
  private readonly logger = new Logger(AuthUserGuard.name);

  constructor(
    private reflector: Reflector,
    private rabbitClient: OrderRabbitClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();
    // Verificar si la ruta es pública
    // Esto nos dirá si EXISTE algo llamado 'isPublic' en la memoria de Refl
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        handler,
        controller,
      ]) || false;

    console.log('¿Es ruta pública?', isPublic);
    if (isPublic) {
      return true;
    }

    try {
      // Obtener token del header
      const authHeader = request.headers.authorization;
      console.log(authHeader);
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
