import { Controller, Get, Delete, Param } from '@nestjs/common';

@Controller('internal/cache/products')
export class CacheProductController {
  @Delete()
  clearCache() {}

  @Delete(':id')
  clearProductCache(@Param('id') id: string) {}

  @Get(':id')
  getCache(@Param('id') id: string) {}
}
