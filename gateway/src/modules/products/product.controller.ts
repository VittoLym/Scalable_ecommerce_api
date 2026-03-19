import { Controller, Get } from '@nestjs/common';
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';

@Controller('products')
export class ProductsController {
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
