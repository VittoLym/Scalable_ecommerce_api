import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly userServiceUrl =
    process.env.USER_SERVICE_URL || 'http://localhost:3001';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No se proporcionó token');
    }

    try {
      // ✅ Validar token vía HTTP, no RabbitMQ
      const response = await axios.post(
        `${this.userServiceUrl}/auth/validate`,
        {},
        { headers: { authorization: `Bearer ${token}` } },
      );

      const user = response.data.user;
      if (user.role !== 'ADMIN') {
        throw new ForbiddenException('Se requiere rol de administrador');
      }

      request.user = user;
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new UnauthorizedException('Token inválido');
      }
      if (error.response?.status === 403) {
        throw new ForbiddenException('No tienes permisos');
      }
      throw new UnauthorizedException('Error de autenticación');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
