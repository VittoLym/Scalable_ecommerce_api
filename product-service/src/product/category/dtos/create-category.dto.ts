import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUrl,
  IsObject,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
  IsUUID,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El nombre no puede tener más de 50 caracteres' })
  name: string;

  @IsString({ message: 'La descripción debe ser un texto' })
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede tener más de 500 caracteres' })
  description?: string;

  @IsUUID('4', { message: 'El ID del padre debe ser un UUID válido' })
  @IsOptional()
  parentId?: string;

  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsUrl({}, { message: 'La URL de la imagen debe ser válida' })
  @IsOptional()
  @MaxLength(500, { message: 'La URL de la imagen no puede tener más de 500 caracteres' })
  imageUrl?: string;

  @IsInt({ message: 'El orden de visualización debe ser un número entero' })
  @Min(0, { message: 'El orden de visualización debe ser mayor o igual a 0' })
  @Max(9999, { message: 'El orden de visualización no puede ser mayor a 9999' })
  @IsOptional()
  @Type(() => Number)
  displayOrder?: number;

  @IsObject({ message: 'Los metadatos deben ser un objeto válido' })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    slug?: string;
  };

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  featured?: boolean;
}

// Ejemplo de uso:
/*
{
  "name": "Electrónica",
  "description": "Categoría de productos electrónicos",
  "parentId": "123e4567-e89b-12d3-a456-426614174000",
  "isActive": true,
  "imageUrl": "https://ejemplo.com/imagen.jpg",
  "displayOrder": 1,
  "metadata": {
    "color": "blue",
    "icon": "electronics-icon"
  },
  "seo": {
    "title": "Electrónica - Tienda Online",
    "description": "Encuentra los mejores productos electrónicos",
    "keywords": ["electrónica", "tecnología", "gadgets"],
    "slug": "electronica"
  },
  "featured": true
}
*/
