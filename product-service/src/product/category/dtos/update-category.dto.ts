import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { IsUUID, IsOptional } from 'class-validator';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @IsUUID('4', { message: 'El ID debe ser un UUID válido' })
  @IsOptional()
  id?: string;
}
