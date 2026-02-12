import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { UserService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [PrismaService],
  controllers: [AppController],
  providers: [UserService],
})
export class AppModule {}
