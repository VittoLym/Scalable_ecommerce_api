import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || '12345678',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
