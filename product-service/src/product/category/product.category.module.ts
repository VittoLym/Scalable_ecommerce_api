import { Module, forwardRef } from '@nestjs/common';
import { CategoryController } from './product.category.controller';
import { CategoryService } from './product.category.service';
import { ProductModule } from '../product.module';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [RedisModule, forwardRef(() => ProductModule)],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
