import {
  Controller,
  Get,
  Body,
  Post,
  Patch,
  Delete,
  UseGuards,
  Query,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Roles } from './auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('USER', 'ADMIN')
  findAll(@Query() filter: FilterProductDto) {
    return this.service.findAll(filter);
  }

  @Get(':id')
  @Roles('USER', 'ADMIN')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
