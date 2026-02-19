import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../auth/dto/login.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';
import { ForgotPasswordDto } from './dto/forgot-password';

@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
}
