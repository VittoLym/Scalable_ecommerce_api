// guards/role.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'decorator/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    // Si no hay roles requeridos, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error('Usuario no encontrado en request');
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Verificar rol
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      this.logger.warn(`⚠️ Usuario ${user.id} con rol ${user.role} no autorizado`);
      throw new ForbiddenException('No tienes permisos suficientes');
    }

    return true;
  }
}
