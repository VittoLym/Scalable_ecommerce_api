import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
  constructor(private readonly httpService: HttpService) {}

  private readonly services = {
    user: 'http://user-service:3001',
    product: 'http://product-service:3002',
    order: 'http://order-service:3003', // Añadir
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
