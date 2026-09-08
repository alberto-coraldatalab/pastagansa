import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { QuoteStatus } from '@prisma/client';

export class QuoteLineDto {
  @IsOptional() @IsUUID() catalogItemId?: string;
  @IsString() @MaxLength(2000) description!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) discountPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) taxRate?: number;
}
export class CreateQuoteDto {
  @IsUUID() contactId!: string;
  @IsDateString() issueDate!: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuoteLineDto) lines!: QuoteLineDto[];
}
export class UpdateQuoteDto extends CreateQuoteDto {}
export class ChangeQuoteStatusDto { @IsEnum(QuoteStatus) status!: QuoteStatus; }
