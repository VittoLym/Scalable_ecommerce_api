import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductController } from './products.controller';
import { AdminGuard } from './auth/guards/admin.guard';
import { ProxyRequest } from 'src/common/interceptor/proxy.interceptor';
import { ProductCategoryController } from './product_category.controller';

@Module({
  controllers: [ProductController, ProductCategoryController],
  providers: [ProductsService, AdminGuard, ProxyRequest],
})
export class ProductsModule {}
