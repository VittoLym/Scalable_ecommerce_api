import { Module, forwardRef } from '@nestjs/common';
import { CategoryController } from './product.category.controller';
import { CategoryService } from './product.category.service';
import { ProductModule } from '../product.module';
import { RedisModule } from '../../redis/redis.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [RedisModule, forwardRef(() => ProductModule), AuthModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
