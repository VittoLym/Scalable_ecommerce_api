import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token de recuperación recibido por email',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'El token debe ser un texto válido' })
  @IsNotEmpty({ message: 'El token es requerido' })
  token: string;

  @ApiProperty({
    description: 'Nueva contraseña (mínimo 8 caracteres, mayúscula, minúscula y número)',
    example: 'NewPassword123',
  })
  @IsString({ message: 'La contraseña debe ser un texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { 
    message: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número' 
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;
}
