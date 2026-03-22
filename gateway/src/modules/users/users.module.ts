import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProxyRequest } from 'src/common/interceptor/proxy.interceptor';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ProxyRequest],
})
export class UsersModule {}
