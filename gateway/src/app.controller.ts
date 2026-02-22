import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Request, Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @All('api/orders/*')
  async proxyOrders(@Req() req: Request, @Res() res: Response) {
    const path = req.path.replace('/api/orders/', '');
    const result = await this.proxyService.forwardRequest(
      'order',
      path,
      req.method,
      req.body,
    );
    res.json(result);
  }
}
