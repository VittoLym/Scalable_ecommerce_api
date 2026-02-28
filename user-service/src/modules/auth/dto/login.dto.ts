import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty({
    example: 'usuario@ejemplo.com',
    description: 'Email del usuario',
    required: true,
  })
  @IsEmail(
    {},
    {
      message: 'Por favor, ingresa un email válido (ej: nombre@dominio.com)',
    },
  )
  @IsNotEmpty({
    message: 'El email es obligatorio',
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña del usuario (mínimo 8 caracteres)',
    required: true,
  })
  @IsString({
    message: 'La contraseña debe ser texto',
  })
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(30, {
    message: 'La contraseña no puede exceder los 30 caracteres',
  })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&)' 
    },
  )
  @IsNotEmpty({
    message: 'La contraseña es obligatoria',
  })
  @Transform(({ value }) => value?.trim())
  password: string;

  @ApiProperty({
    example: '127.0.0.1',
    description: 'IP del cliente (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({
    example: 'Mozilla/5.0...',
    description: 'User agent del cliente (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}
