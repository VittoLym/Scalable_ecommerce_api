import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly baseUrl =
    process.env.USER_SERVICE_URL || 'http://localhost:3001';

  async validateUser(userId: string): Promise<any> {
    try {
      this.logger.log(`🔍 Validando usuario ${userId} en user-service`);
      const response = await axios.get(`${this.baseUrl}/users/${userId}`, {
        headers: {
          'X-API-Key': process.env.INTERNAL_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // Timeout de 5 segundos
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Error validando usuario ${userId}:`, error.message);
      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          'User service no disponible',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (error.response?.status === 404) {
        throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Error validando usuario',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserWithPermissions(userId: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/users/${userId}/permissions`,
      {
        headers: {
          'X-API-Key': process.env.INTERNAL_API_KEY,
        },
      },
    );
    return response.data;
  }
}
