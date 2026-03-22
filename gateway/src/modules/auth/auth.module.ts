import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ProxyRequest } from 'src/common/interceptor/proxy.interceptor';

@Module({
  controllers: [AuthController],
  providers: [AuthService, ProxyRequest],
})
export class AuthModule {}
