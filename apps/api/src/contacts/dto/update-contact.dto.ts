import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class UpdateContactDto {
  @IsOptional() @IsString() @MaxLength(240) legalName?: string;
  @IsOptional() @IsString() @MaxLength(240) tradeName?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9][A-Za-z0-9 -]{1,38}[A-Za-z0-9]$/) taxId?: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) paymentTermsDays?: number;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  @IsOptional() @IsBoolean() isCustomer?: boolean;
  @IsOptional() @IsBoolean() isSupplier?: boolean;
}
