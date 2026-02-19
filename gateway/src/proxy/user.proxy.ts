import { Controller, All, Req, Res } from '@nestjs/common';
import axios from 'axios';
import type { Request, Response } from 'express';

@Controller('auth')
export class UserProxyController {
  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    const url = `http://user-service:3000/auth${req.url}`;

    try {
      const response = await axios({
        method: req.method as any,
        url,
        data: req.body,
        headers: {
          Authorization: req.headers.authorization,
        },
      });

      return res.status(response.status).json(response.data);

    } catch (error: any) {
      return res
        .status(error.response?.status || 500)
        .json(error.response?.data || { message: 'Gateway error' });
    }
  }
}
