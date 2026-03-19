import {
  Controller,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppService } from './app.service';
import type { Request, Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthStatus(): object {
    return {
      message: 'hola',
      status: 'mandarina con pollo',
    };
  }
}
