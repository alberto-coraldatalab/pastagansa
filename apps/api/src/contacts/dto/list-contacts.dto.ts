import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export enum ContactKind {
  CUSTOMER = "CUSTOMER",
  SUPPLIER = "SUPPLIER",
}

export class ListContactsDto {
  @IsOptional()
  @IsEnum(ContactKind)
  kind?: ContactKind;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
