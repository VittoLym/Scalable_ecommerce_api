import {
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FilterProductDto {
  // 🔎 Búsqueda
  @IsOptional()
  @IsString()
  search?: string;

  // 💰 Rango de precio
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  // 📦 Estado
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  // 📄 Paginación
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  // 🔃 Orden
  @IsOptional()
  @IsIn(['price', 'createdAt', 'name'])
  sortBy?: 'price' | 'createdAt' | 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
