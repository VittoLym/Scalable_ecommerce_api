import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { ProxyRequest } from 'src/common/interceptor/proxy.interceptor';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, ProxyRequest],
})
export class PaymentsModule {}
