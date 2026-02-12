import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { AuthProvider, Role } from '@prisma/client';

export class RegisterUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one letter and one number',
  })
  password?: string;

  @IsOptional()
  @IsEnum(AuthProvider)
  authProvider?: AuthProvider = AuthProvider.LOCAL;

  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.USER;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}
