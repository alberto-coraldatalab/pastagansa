import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { QuoteStatus } from "@prisma/client";
import { IsCurrencyCode, IsNotBlank } from "../../common/validation";

export class QuoteLineDto {
  @IsOptional() @IsUUID() catalogItemId?: string;
  @IsString() @MaxLength(2000) @IsNotBlank() description!: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPct?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;
}
export class CreateQuoteDto {
  @IsUUID() contactId!: string;
  @IsDateString() issueDate!: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsCurrencyCode() currency?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
}
export class UpdateQuoteDto extends CreateQuoteDto {}
export class ChangeQuoteStatusDto {
  @IsEnum(QuoteStatus) expectedStatus!: QuoteStatus;
  @IsEnum(QuoteStatus) status!: QuoteStatus;
}
