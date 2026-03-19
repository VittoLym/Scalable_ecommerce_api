import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('products')
export class ProductsController {
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthStatus(): object {
    return {
      message: 'hola',
      status: 'Products is Done',
    };
  }
  @Get()
  getAll() {
    return proxyRequest(
      'GET',
      `${process.env.PRODUCT_SERVICE_URL}/products`,
      null,
      {},
    );
  }
}
