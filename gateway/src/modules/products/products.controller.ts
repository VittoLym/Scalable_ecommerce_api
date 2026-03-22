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
import { proxyRequest } from '../../common/interceptor/proxy.interceptor';
import axios from 'axios';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

const PRODUCT_SERVICE =
  process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

@Controller('products')
export class ProductController {
  @Get('health')
  health(@Req() req: Request) {
    try {
      const response = proxyRequest(
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
  @Post()
  create(@Body() body, @Req() req: Request) {
    try {
      const response = proxyRequest(
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
  findAll(@Query() query, @Req() req: Request) {
    try {
      const response = proxyRequest(
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
  findOne(@Param('id') id: string, @Req() req: Request) {
    try {
      const response = proxyRequest(
        'GET',
        `${PRODUCT_SERVICE}/products/${id}`,
        null,
        {
          headers: {
            authorization: req.headers.authorization,
          },
        },
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() body, @Req() req: Request) {
    try {
      const response = proxyRequest(
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
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    try {
      const response = proxyRequest(
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
      return new HttpException(error.response.data,error.response.status);
    }

    return new HttpException('Error en API Gateway', 500);
  }
}
