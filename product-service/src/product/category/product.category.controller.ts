/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './product.category.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { FilterCategoryDto } from './dtos/filter-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { BulkOperationDto } from 'src/dto/bulk-operation.dto';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('products/category')
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(AdminGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCategoryDto) {
    try {
      this.logger.log(`Creando categoría: ${dto.name}`);
      const category = await this.categoryService.create(dto);
      return {
        success: true,
        message: 'Categoría creada exitosamente',
        data: category,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() filterDto: FilterCategoryDto) {
    try {
      this.logger.log('Obteniendo lista de categorías');
      const result = await this.categoryService.findAll(filterDto);
      return {
        success: true,
        message: 'Categorías obtenidas exitosamente',
        ...result,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    try {
      this.logger.log(`Buscando categoría con ID: ${id}`);
      const category = await this.categoryService.findById(id);
      return {
        success: true,
        message: 'Categoría encontrada',
        data: category,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @Get(':id/products')
  @HttpCode(HttpStatus.OK)
  async getProducts(@Param('id', new ParseUUIDPipe()) id: string) {
    try {
      this.logger.log(`Obteniendo productos de categoría: ${id}`);
      const products = await this.categoryService.getProducts(id);
      return {
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: products,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Get('tree/all')
  @HttpCode(HttpStatus.OK)
  async getTree() {
    try {
      this.logger.log('Obteniendo árbol de categorías');
      const tree = await this.categoryService.getCategoryTree();
      return {
        success: true,
        message: 'Árbol de categorías obtenido exitosamente',
        data: tree,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Get(':id/breadcrumb')
  @HttpCode(HttpStatus.OK)
  async getBreadcrumb(@Param('id', new ParseUUIDPipe()) id: string) {
    try {
      this.logger.log(`Obteniendo breadcrumb para categoría: ${id}`);
      const breadcrumb = await this.categoryService.getBreadcrumb(id);
      return {
        success: true,
        message: 'Breadcrumb obtenido exitosamente',
        data: breadcrumb,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @Get(':id/path')
  @HttpCode(HttpStatus.OK)
  async getPath(@Param('id', new ParseUUIDPipe()) id: string) {
    try {
      this.logger.log(`Obteniendo ruta para categoría: ${id}`);
      const path = await this.categoryService.getCategoryPath(id);
      return {
        success: true,
        message: 'Ruta obtenida exitosamente',
        data: path,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Get('stats/summary')
  @HttpCode(HttpStatus.OK)
  async getStats() {
    try {
      this.logger.log('Obteniendo estadísticas de categorías');
      const stats = await this.categoryService.getCategoryStats();
      return {
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    try {
      this.logger.log(`Actualizando categoría: ${id}`);
      const category = await this.categoryService.update(id, updateCategoryDto);
      return {
        success: true,
        message: 'Categoría actualizada exitosamente',
        data: category,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    try {
      this.logger.log(`Eliminando categoría: ${id}`);
      await this.categoryService.remove(id);
      return {
        success: true,
        message: 'Categoría eliminada exitosamente',
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Delete('bulk/remove')
  @HttpCode(HttpStatus.OK)
  async bulkRemove(@Body() bulkOperationDto: BulkOperationDto) {
    try {
      this.logger.log(
        `Eliminando múltiples categorías: ${bulkOperationDto.ids.length}`,
      );
      const results: {
        id: string;
        success: boolean;
        error: { message: string };
      }[] = [];
      for (const id of bulkOperationDto.ids) {
        try {
          await this.categoryService.remove(id);
          results.push({ id, success: true, error: { message: 'all safe' } });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      return {
        success: true,
        message: 'Operación masiva completada',
        data: results,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Patch('bulk/status')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateStatus(@Body() bulkOperationDto: BulkOperationDto) {
    try {
      this.logger.log(
        `Actualizando estado masivo: ${bulkOperationDto.ids.length} categorías`,
      );
      if (bulkOperationDto.isActive === undefined) {
        throw new Error('isActive es requerido');
      }
      await this.categoryService.bulkUpdateStatus(
        bulkOperationDto.ids,
        bulkOperationDto.isActive,
      );
      return {
        success: true,
        message: `Categorías ${bulkOperationDto.isActive ? 'activadas' : 'desactivadas'} exitosamente`,
        data: {
          updatedIds: bulkOperationDto.ids,
          isActive: bulkOperationDto.isActive,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @Get('search/by-name')
  @HttpCode(HttpStatus.OK)
  async findByName(@Query('name') name: string) {
    try {
      this.logger.log(`Buscando categoría por nombre: ${name}`);
      const category = await this.categoryService.findByName(name);
      return {
        success: true,
        message: category ? 'Categoría encontrada' : 'Categoría no encontrada',
        data: category,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error creando categoría: ${error.message}`);
      } else {
        this.logger.error('Error creando categoría: error desconocido');
      }
      throw error;
    }
  }

  @UseGuards(AdminGuard)
  @Get('health/status')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    try {
      const stats = await this.categoryService.getCategoryStats();
      return {
        success: true,
        message: 'Servicio de categorías funcionando correctamente',
        timestamp: new Date().toISOString(),
        data: {
          status: 'healthy',
          stats,
          uptime: process.uptime(),
        },
      };
    } catch (error) {
      this.logger.error(`Error en health check: ${error.message}`);
      return {
        success: false,
        message: 'Servicio de categorías con problemas',
        timestamp: new Date().toISOString(),
        data: {
          status: 'unhealthy',
          error: error.message,
          uptime: process.uptime(),
        },
      };
    }
  }
}
