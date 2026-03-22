import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductController } from './products.controller';
import { AdminGuard } from './auth/guards/admin.guard';
import { ProxyRequest } from 'src/common/interceptor/proxy.interceptor';

@Module({
  controllers: [ProductController],
  providers: [ProductsService, AdminGuard, ProxyRequest],
})
export class ProductsModule {}
