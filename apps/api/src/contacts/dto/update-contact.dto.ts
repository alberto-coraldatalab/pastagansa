import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateContactDto {
  @IsOptional() @IsString() @MaxLength(240) legalName?: string;
  @IsOptional() @IsString() @MaxLength(240) tradeName?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9][A-Za-z0-9 -]{1,38}[A-Za-z0-9]$/) taxId?: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsBoolean() isCustomer?: boolean;
  @IsOptional() @IsBoolean() isSupplier?: boolean;
}
