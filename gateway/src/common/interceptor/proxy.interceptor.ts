import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosRequestConfig, AxiosError } from 'axios';

@Injectable()
export class ProxyRequest {
  async request<T = any>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    console.log('📤 [ProxyRequest] Iniciando petición:', { method, url });
    console.log('📦 [ProxyRequest] Datos:', data);
    try {
      console.log('este es el proxyReques');
      const response = await axios({
        method,
        url,
        data,
        ...config,
        timeout: 10000,
      });
      console.log('✅ [ProxyRequest] Respuesta exitosa:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      });
      return response.data;
    } catch (error) {
      // 👈 LOG DEL ERROR
      console.log('❌ [ProxyRequest] Error capturado:');
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.log('  - Código:', axiosError.code);
        console.log('  - Mensaje:', axiosError.message);
        if (axiosError.response) {
          console.log('  - Status:', axiosError.response.status);
          console.log('  - Data:', axiosError.response.data);
        }
        if (axiosError.request) {
          console.log('  - Request URL:', axiosError.request?.res?.responseUrl || url);
        }
        
        if (axiosError.code === 'ECONNREFUSED') {
          throw new HttpException(
            `Servicio no disponible en ${url}`,
            503,
          );
        }
        
        if (axiosError.code === 'ETIMEDOUT') {
          throw new HttpException(
            `Tiempo de espera agotado: ${url}`,
            504,
          );
        }
        
        if (axiosError.response) {
          throw new HttpException(
            axiosError.response.data || 'Error en servicio',
            axiosError.response.status,
          );
        }
      }
      
      console.log('  - Error original:', error);
      throw new HttpException('Servicio no disponible', 503);
    }
  }
}
