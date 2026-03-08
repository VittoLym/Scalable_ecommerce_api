import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, catchError, map, timeout, firstValueFrom } from 'rxjs';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('Intento de acceso sin token');
      throw new UnauthorizedException('No se proporcionó token de autenticación');
    }

    try {
      const userData = await this.validateTokenWithUserService(token);
      if (!this.isAdmin(userData)) {
        this.logger.warn(`Usuario ${userData.email} intentó acceder sin ser admin`);
        throw new ForbiddenException('Se requiere rol de administrador');
      }
      request.user = userData;
      this.logger.log(`✅ Acceso permitido para admin: ${userData.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Error en autorización: ${error.message}`);
      throw error;
    }
  }
  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
  private async validateTokenWithUserService(token: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.userClient.send('validate_token', { token }).pipe(
          timeout(5000), // Timeout de 5 segundos
          catchError(error => {
            throw new Error(`Error en user-service: ${error.message}`);
          }),
        ),
      );
      if (!response || !response.valid) {
        throw new UnauthorizedException('Token inválido o expirado');
      }
      return response.user;
    } catch (error) {
      this.logger.error(`Error validando token: ${error.message}`);
      throw new UnauthorizedException('Error al validar autenticación');
    }
  }
  private isAdmin(userData: any): boolean {
    const roles = userData.roles || userData.role || [];
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes('ADMIN') || roleList.includes('admin');
  }
}
