import { IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class MoveCategoryDto {
  @IsUUID('4')
  @IsOptional()
  newParentId?: string | null;

  @IsOptional()
  @IsBoolean()
  maintainChildren?: boolean;
}
