import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
  constructor(private readonly httpService: HttpService) {}

  private readonly services = {
    user: 'http://user-service:3001', // Nombre del contenedor Docker
    product: 'http://product-service:3002',
  };

  async forwardRequest(service: string, path: string, method: string, data?: any) {
    const url = `${this.services[service]}/${path}`;
    
    const response = await firstValueFrom(
      this.httpService.request({
        method,
        url,
        data,
      }),
    );
    
    return response.data;
  }
}
