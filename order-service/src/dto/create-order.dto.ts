import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEmail,
  Min,
  IsObject,
  IsUUID,
} from 'class-validator';

export class OrderItemDto {
  @IsString()
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsObject()
  productSnapshot?: any;
}

export class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  zipCode: string;

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}

export class CreateOrderDto {
  @IsUUID()
  @IsString()
  userId: string;

  @IsOptional()
  @IsEmail()
  userEmail?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
