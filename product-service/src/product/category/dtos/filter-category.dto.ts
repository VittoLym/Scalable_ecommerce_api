import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsUUID,
  Min,
  Max,
  IsIn,
  IsDateString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FilterCategoryDto {
  @IsString({ message: 'La búsqueda debe ser un texto' })
  @IsOptional()
  @MinLength(2, { message: 'La búsqueda debe tener al menos 2 caracteres' })
  search?: string;

  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsUUID('4', { message: 'El ID del padre debe ser un UUID válido' })
  @IsOptional()
  parentId?: string;

  @IsBoolean({ message: 'includeSubcategories debe ser un valor booleano' })
  @IsOptional()
  @Type(() => Boolean)
  includeSubcategories?: boolean;

  @IsNumber({}, { message: 'El número de página debe ser un número' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede ser mayor a 100' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsString({ message: 'El campo de ordenamiento debe ser un texto' })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'updatedAt', 'displayOrder', 'id'], {
    message: 'El campo de ordenamiento no es válido',
  })
  sortBy?: string = 'name';

  @IsString({ message: 'La dirección de ordenamiento debe ser un texto' })
  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'La dirección de ordenamiento debe ser asc o desc',
  })
  sortOrder?: 'asc' | 'desc' = 'asc';

  @IsBoolean({ message: 'hasSubcategories debe ser un valor booleano' })
  @IsOptional()
  @Type(() => Boolean)
  hasSubcategories?: boolean;

  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida' })
  @IsOptional()
  startDate?: string;

  @IsDateString({}, { message: 'La fecha de fin debe ser una fecha válida' })
  @IsOptional()
  endDate?: string;

  @IsBoolean({ message: 'featured debe ser un valor booleano' })
  @IsOptional()
  @Type(() => Boolean)
  featured?: boolean;

  @IsString({ message: 'El slug debe ser un texto' })
  @IsOptional()
  slug?: string;

  @IsBoolean({ message: 'includeProducts debe ser un valor booleano' })
  @IsOptional()
  @Type(() => Boolean)
  includeProducts?: boolean;

  @IsBoolean({ message: 'includeChildren debe ser un valor booleano' })
  @IsOptional()
  @Type(() => Boolean)
  includeChildren?: boolean;

  @IsBoolean({ message: 'includeParent debe ser un valor booleano' })
  @IsOptional()
  @Type(() => Boolean)
  includeParent?: boolean;
}

// Ejemplo de uso:
/*
{
  "search": "electr",
  "isActive": true,
  "parentId": "123e4567-e89b-12d3-a456-426614174000",
  "includeSubcategories": true,
  "page": 1,
  "limit": 20,
  "sortBy": "name",
  "sortOrder": "asc",
  "hasSubcategories": true,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "featured": true,
  "includeProducts": true,
  "includeChildren": true,
  "includeParent": true
}
*/
