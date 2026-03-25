import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext,
} from '@nestjs/microservices';
import { UserService } from '../user/user.service';

@Controller()
export class RabbitController {
  private readonly logger = new Logger(RabbitController.name);

  constructor(private readonly userService: UserService) {}
  @MessagePattern('user.validate')
  async validateUser(@Payload() data: { userId: string }) {
    this.logger.log(`✅ [user.validate] Validando usuario`);
    try {
      let userId = data.userId;
      // Verificar si es un JWT (tiene 3 partes separadas por puntos)
      if (data.userId && data.userId.split('.').length === 3) {
        this.logger.log('🔑 Token JWT detectado, decodificando...');
        // Decodificar JWT (extraer el payload)
        const base64Payload = data.userId.split('.')[1];
        // Reemplazar caracteres de base64url a base64
        const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = Buffer.from(base64, 'base64').toString();
        const payload = JSON.parse(payloadJson);
        // Extraer el sub (subject) que es el userId
        userId = payload.sub;
        this.logger.log(
          `✅ Token decodificado - UserID: ${userId}, Role: ${payload.role}`
        );
        console.log(payload);
      }
      const user = await this.userService.findById(userId);
      if (!user) {
        this.logger.warn(`⚠️ Usuario no encontrado: ${userId}`);
        return {
          success: false,
          error: 'Usuario no encontrado',
        };
      }
      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.profile?.fullName || user.email,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error validando usuario: ${error.message}`);
      return {
        success: false,
        error: 'Error interno en user-service',
      };
    }
  }
  @MessagePattern('ping')
  handlePing(@Payload() data: any) {
    this.logger.log('📡 Ping recibido desde:', data?.from || 'desconocido');
    return {
      pong: true,
      timestamp: new Date().toISOString(),
      service: 'user-service',
      receivedFrom: data?.from || 'unknown'
    };
  }
  @MessagePattern('get_user_by_id')
  async handleGetUserById(@Payload() data: { userId: string }) {
    this.logger.log(`🔍 [get_user_by_id] Solicitado usuario: ${data.userId}`);
    
    try {
      const user = await this.userService.findById(data.userId);
      
      if (!user) {
        return {
          success: false,
          error: 'Usuario no encontrado',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      this.logger.error(`❌ Error en get_user_by_id: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  @MessagePattern('get_user_profile')
  async handleGetUserProfile(@Payload() data: { userId: string }) {
    this.logger.log(`👤 [get_user_profile] Solicitado perfil: ${data.userId}`);
    
    try {
      const user = await this.userService.findById(data.userId);
      
      if (!user) {
        return {
          success: false,
          error: 'Usuario no encontrado',
        };
      }

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          fullName: user.profile?.fullName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
          role: user.role,
          avatar: user.profile?.avatar,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error en get_user_profile: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  @MessagePattern('user_exists')
  async handleUserExists(@Payload() data: { userId: string }) {
    this.logger.log(`❓ [user_exists] Verificando usuario: ${data.userId}`);
    
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
  @MessagePattern('user_updated_login')
  async handleUserLogin(
    @Payload() data: { userId: string; ip?: string; userAgent?: string },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    
    this.logger.log('🔐 [user_updated_login] Mensaje recibido');
    this.logger.debug('📦 Datos:', JSON.stringify(data));

    try {
      // Aquí puedes actualizar el último login en la BD si lo deseas
      // await this.userService.updateLastLogin(data.userId, data.ip);
      
      this.logger.log(`✅ Login actualizado para usuario: ${data.userId}`);
      
      // Confirmar mensaje
      channel.ack(originalMsg);
      
      return {
        success: true,
        data: {
          updated: true,
          userId: data.userId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error en user_updated_login: ${error.message}`);
      
      // Rechazar mensaje (volverá a la cola)
      channel.nack(originalMsg);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
  /**
   * Obtener permisos de usuario
   */
  @MessagePattern('user.permissions')
  async getUserPermissions(@Payload() data: { userId: string }) {
    this.logger.log(`🔑 [user.permissions] Solicitando permisos: ${data.userId}`);
    
    try {
      const user = await this.userService.findByIdWithRelations(data.userId);
      
      if (!user) {
        throw new Error('Usuario inválido');
      }

      // Aquí puedes agregar lógica de permisos más compleja
      const permissions = this.getPermissionsForRole(user.role);

      return {
        success: true,
        data: {
          roles: [user.role],
          permissions: permissions,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error en user.permissions: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Validación batch de usuarios
   */
  @MessagePattern('user.batch.validate')
  async batchValidateUsers(@Payload() data: { userIds: string[] }) {
    this.logger.log(`📊 [user.batch.validate] Validando ${data.userIds?.length || 0} usuarios`);
    
    try {
      if (!data.userIds || data.userIds.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      const users = await this.userService.findByIds(data.userIds);
      this.logger.log(`✅ Encontrados ${users.length} de ${data.userIds.length} usuarios`);

      return {
        success: true,
        data: users.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
        })),
      };
    } catch (error) {
      this.logger.error(`❌ Error en batch validation: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Endpoint para obtener múltiples usuarios con perfil completo
   */
  @MessagePattern('user.batch.profile')
  async batchGetProfiles(@Payload() data: { userIds: string[] }) {
    this.logger.log(`👥 [user.batch.profile] Solicitando perfiles de ${data.userIds?.length || 0} usuarios`);
    
    try {
      const users = await this.userService.findByIds(data.userIds);
      
      return {
        success: true,
        data: users.map(user => ({
          id: user.id,
          email: user.email,
          role: user.role,
        })),
      };
    } catch (error) {
      this.logger.error(`❌ Error en batch.profile: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Helper para obtener permisos basados en rol
   */
  private getPermissionsForRole(role: string): string[] {
    const permissionsMap = {
      'ADMIN': ['users:read', 'users:write', 'users:delete', 'orders:read', 'orders:write', 'products:read', 'products:write'],
      'USER': ['users:read:self', 'orders:read:self', 'orders:write:self'],
      'GUEST': ['products:read'],
    };

    return permissionsMap[role] || permissionsMap['GUEST'];
  }
}
