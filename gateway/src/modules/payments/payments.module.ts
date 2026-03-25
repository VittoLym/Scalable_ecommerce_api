import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentController } from './payments.controller';
import { ProxyRequest } from 'src/common/interceptor/proxy.interceptor';

@Module({
  controllers: [PaymentController],
  providers: [PaymentsService, ProxyRequest],
})
export class PaymentsModule {}
