import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { CategoryService } from './product.category.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { FilterCategoryDto } from './dtos/filter-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';

@Controller('product/category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Get()
  findAll(@Query() filter: FilterCategoryDto) {
    return this.categoryService.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Get(':id/products')
  getProductsByCategory(@Param('id') id: string) {
    return this.categoryService.getProducts(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
