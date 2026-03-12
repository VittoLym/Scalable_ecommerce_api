import { IsString, IsOptional, IsPostalCode, IsNotEmpty } from 'class-validator';

export class AddressDto {
  @IsString()
  @IsNotEmpty({ message: 'La calle es requerida' })
  street: string;

  @IsString()
  @IsNotEmpty({ message: 'La ciudad es requerida' })
  city: string;

  @IsString()
  @IsNotEmpty({ message: 'El código postal es requerido' })
  @IsPostalCode('any')
  zipCode: string;

  @IsString()
  @IsNotEmpty({ message: 'El país es requerido' })
  country: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string; // Barrio o colonia

  @IsOptional()
  @IsString()
  municipality?: string; // Municipio o delegación

  @IsOptional()
  @IsString()
  betweenStreets?: string; // Entre calles
}

/**
 * DTO para actualizar dirección
 */
export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  @IsPostalCode('any')
  zipCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @IsString()
  betweenStreets?: string;
}
