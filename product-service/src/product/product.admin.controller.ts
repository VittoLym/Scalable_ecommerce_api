import { Controller, Patch, Post, Param } from '@nestjs/common';

@Controller('products/admin')
export class AdminProductContoller {
  @Patch(':id/status')
  changeStatus(@Param('id') id: string) {
    /* return this.service.toggleStatus(id);*/
    console.log(id);
  }

  @Post(':id/feature')
  featureProduct(@Param('id') id: string) {
    /*return this.service.markAsFeatured(id);*/
    console.log(id);
  }
}
