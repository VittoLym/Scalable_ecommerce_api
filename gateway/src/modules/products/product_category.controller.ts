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
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from './auth/guards/admin.guard';
import { Public } from './dto/skip-roles.decorator';
import { ProxyRequest } from '../../common/interceptor/proxy.interceptor';

const CATEGORY_SERVICE_URL =
  process.env.CATEGORY_SERVICE_URL || 'http://localhost:3005';

@Controller('products/category')
export class ProductCategoryController {
  private readonly logger = new Logger(ProductCategoryController.name);
  constructor(readonly proxyRequest: ProxyRequest) {}
  @UseGuards(AdminGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body, @Req() req: Request) {
    this.logger.log(`📦 Creando categoría: ${body.name}`);
    try {
      const response = await this.proxyRequest.request(
        'POST',
        `${CATEGORY_SERVICE_URL}/products/category`,
        body,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 10000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error creando categoría: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query, @Req() req: Request) {
    this.logger.log(
      `📋 Listando categorías - Filtros: ${JSON.stringify(query)}`,
    );
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category`,
        null,
        {
          params: query,
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error listando categorías: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    this.logger.log(`🔍 Buscando categoría: ${id}`);
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category/${id}`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error buscando categoría ${id}: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @Get(':id/products')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getProducts(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    this.logger.log(`📦 Obteniendo productos de categoría: ${id}`);
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category/${id}/products`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error obteniendo productos de categoría ${id}: ${error.message}`);
      throw this.handleError(error);
    }
  }

  @Get('tree/all')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getTree(@Req() req: Request) {
    this.logger.log(`🌳 Obteniendo árbol de categorías`);
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category/tree/all`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error obteniendo árbol de categorías: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @Get(':id/breadcrumb')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getBreadcrumb(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    this.logger.log(`🍞 Obteniendo breadcrumb para categoría: ${id}`);
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category/${id}/breadcrumb`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error obteniendo breadcrumb para categoría ${id}: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @Get(':id/path')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getPath(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    this.logger.log(`🗺️ Obteniendo ruta para categoría: ${id}`);
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category/${id}/path`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error obteniendo ruta para categoría ${id}: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @Get('search/by-name')
  @Public()
  @HttpCode(HttpStatus.OK)
  async findByName(@Query('name') name: string, @Req() req: Request) {
    this.logger.log(`🔍 Buscando categoría por nombre: ${name}`);
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category/search/by-name?name=${encodeURIComponent(name)}`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error buscando categoría por nombre: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @UseGuards(AdminGuard)
  @Get('stats/summary')
  @HttpCode(HttpStatus.OK)
  async getStats(@Req() req: Request) {
    this.logger.log(`📊 Obteniendo estadísticas de categorías`);
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category/stats/summary`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @UseGuards(AdminGuard)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body,
    @Req() req: Request,
  ) {
    this.logger.log(`✏️ Actualizando categoría: ${id}`);
    try {
      const response = await this.proxyRequest.request(
        'PATCH',
        `${CATEGORY_SERVICE_URL}/products/category/${id}`,
        body,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 10000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error actualizando categoría ${id}: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @UseGuards(AdminGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    this.logger.log(`🗑️ Eliminando categoría: ${id}`);
    try {
      const response = await this.proxyRequest.request(
        'DELETE',
        `${CATEGORY_SERVICE_URL}/products/category/${id}`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error eliminando categoría ${id}: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @UseGuards(AdminGuard)
  @Delete('bulk/remove')
  @HttpCode(HttpStatus.OK)
  async bulkRemove(@Body() body, @Req() req: Request) {
    this.logger.log(`🗑️ Eliminación masiva: ${body.ids?.length || 0} categorías`);
    try {
      const response = await this.proxyRequest.request(
        'DELETE',
        `${CATEGORY_SERVICE_URL}/products/category/bulk/remove`,
        body,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 15000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error en eliminación masiva: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @UseGuards(AdminGuard)
  @Patch('bulk/status')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateStatus(@Body() body, @Req() req: Request) {
    this.logger.log(`🔄 Actualización masiva de estado: ${body.ids?.length || 0} categorías`);
    try {
      const response = await this.proxyRequest.request(
        'PATCH',
        `${CATEGORY_SERVICE_URL}/products/category/bulk/status`,
        body,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 15000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error en actualización masiva: ${error.message}`);
      throw this.handleError(error);
    }
  }
  @Get('health/status')
  @Public()
  @HttpCode(HttpStatus.OK)
  async healthCheck(@Req() req: Request) {
    this.logger.log(`🏥 Health check - Category Service`);
    try {
      const response = await this.proxyRequest.request(
        'GET',
        `${CATEGORY_SERVICE_URL}/products/category/health/status`,
        null,
        {
          headers: { authorization: req.headers.authorization },
          timeout: 5000,
        },
      );
      return response;
    } catch (error) {
      this.logger.error(`Error en health check: ${error.message}`);
      return {
        success: false,
        message: 'Servicio de categorías no disponible',
        timestamp: new Date().toISOString(),
        data: {
          status: 'unhealthy',
          error: error.message,
        },
      };
    }
  }
  private handleError(error: any): any {
    if (error.response) {
      return error.response.data;
    }
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        message: 'Servicio de categorías no disponible',
        error: 'Service Unavailable',
      };
    }
    if (error.code === 'ETIMEDOUT') {
      return {
        success: false,
        message: 'Tiempo de espera agotado',
        error: 'Gateway Timeout',
      };
    }
    return {
      success: false,
      message: 'Error en API Gateway',
      error: error.message,
    };
  }
}
