import { IsNumber, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  amount: number;

  @IsNumber()
  orderNumber: number;

  @IsString()
  orderId: string;

  @IsString()
  description: string;

  @IsString()
  status: string;
}
