import { IsArray, IsBoolean, IsUUID, IsOptional } from 'class-validator';

export class BulkOperationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}