import { Controller, All, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('api/users/*')
  async proxyUsers(@Req() req: Request, @Res() res: Response) {
    const path = req.path.replace('/api/users/', '');
    const result = await this.proxyService.forwardRequest(
      'user',
      path,
      req.method,
      req.body,
    );
    res.json(result);
  }

  @All('api/products/*')
  async proxyProducts(@Req() req: Request, @Res() res: Response) {
    const path = req.path.replace('/api/products/', '');
    const result = await this.proxyService.forwardRequest(
      'product',
      path,
      req.method,
      req.body,
    );
    res.json(result);
  }
}
