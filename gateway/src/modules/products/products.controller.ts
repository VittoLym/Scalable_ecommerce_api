import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from './auth/guards/admin.guard';
import { proxyRequest } from 'src/common/interceptor/proxy.interceptor';

const PRODUCT_SERVICE =
  process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

@Controller('products')
export class ProductController {
  @Get('health')
  async health(@Req() req: Request) {
    try {
      const response = await proxyRequest(
        'GET',
        `${PRODUCT_SERVICE}/products/health`,
        null,
        {
          headers: {
            authorization: req.headers.authorization,
          },
        },
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  @UseGuards(AdminGuard)
  @Post()
  async create(@Body() body, @Req() req: Request) {
    try {
      const response = await proxyRequest(
        'POST',
        `${PRODUCT_SERVICE}/products`,
        body,
        {
          headers: {
            authorization: req.headers.authorization,
          },
        },
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  @Get()
  async findAll(@Query() query, @Req() req: Request) {
    try {
      const response = await proxyRequest(
        'GET',
        `${PRODUCT_SERVICE}/products`,
        null,
        {
          params: query,
          headers: {
            authorization: req.headers.authorization,
          },
        },
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    try {
      const response = await proxyRequest(
        'GET',
        `${PRODUCT_SERVICE}/products/${id}`,
        null,
        {
          headers: {
            authorization: req.headers.authorization,
          },
        },
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  @UseGuards(AdminGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body, @Req() req: Request) {
    try {
      const response = await proxyRequest(
        'PUT',
        `${PRODUCT_SERVICE}/products/${id}`,
        body,
        {
          headers: {
            authorization: req.headers.authorization,
          },
        },
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  @UseGuards(AdminGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    try {
      const response = await proxyRequest(
        'DELETE',
        `${PRODUCT_SERVICE}/products/${id}`,
        null,
        {
          headers: {
            authorization: req.headers.authorization,
          },
        },
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  private handleError(error: any) {
    if (error.response) {
      return new HttpException(error.response.data, error.response.status);
    }
    return new HttpException('Error en API Gateway', 500);
  }
}
