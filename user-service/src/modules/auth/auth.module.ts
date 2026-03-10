import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { EmailModule } from 'src/email/email.module';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { AuthGuard as AG } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule,
    forwardRef(() => UserModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AG, AuthService, PrismaService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
