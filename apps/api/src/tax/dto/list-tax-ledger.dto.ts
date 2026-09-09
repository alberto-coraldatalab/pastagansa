import { TaxBookType, TaxLedgerDirection } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class ListTaxLedgerDto {
  @IsOptional() @IsUUID() invoiceId?: string;
  @IsOptional() @IsEnum(TaxLedgerDirection) direction?: TaxLedgerDirection;
  @IsOptional() @IsEnum(TaxBookType) bookType?: TaxBookType;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
