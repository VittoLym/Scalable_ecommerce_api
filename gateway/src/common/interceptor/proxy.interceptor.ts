import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';

@Injectable()
export class ProxyRequest {
  async request<T = any>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await axios({
        method,
        url,
        data,
        ...config,
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new HttpException(
          error.response.data?.message || 'Error en servicio',
          error.response.status,
        );
      }
      throw new HttpException('Servicio no disponible', 503);
    }
  }
}
