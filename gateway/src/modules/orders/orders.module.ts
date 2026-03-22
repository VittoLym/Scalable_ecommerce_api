import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ProxyRequest } from 'src/common/interceptor/proxy.interceptor';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, ProxyRequest],
})
export class OrdersModule {}
