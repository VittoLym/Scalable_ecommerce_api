import { Controller, All, Req, Res, Post, Body } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { EventsService } from '../events/event.service';

@Controller()
export class ProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly eventsService: EventsService,
  ) {}

  @All('api/users/*')
  async proxyUsers(@Req() req: Request, @Res() res: Response) {
    const path = req.path.replace('/api/users/', '');
    const result = await this.proxyService.forwardRequest(
      'user',
      path,
      req.method,
      req.body,
    );
    // Emitir evento cuando se crea un usuario
    if (req.method === 'POST' && path === '') {
      this.eventsService.emitEvent('user.created', result);
    }
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
    // Emitir evento cuando se crea un producto
    if (req.method === 'POST' && path === '') {
      this.eventsService.emitEvent('product.created', result);
    }
    res.json(result);
  }

  // Endpoint para probar eventos manualmente
  @Post('events/test')
  async testEvent(@Body() body: any) {
    this.eventsService.emitEvent('test.event', body);
    return { message: 'Event emitted' };
  }
}
