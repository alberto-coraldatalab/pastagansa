import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AddressType } from '@prisma/client';

export class CreateContactAddressDto {
  @IsOptional() @IsEnum(AddressType) type?: AddressType;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsString() @MaxLength(240) line1!: string;
  @IsOptional() @IsString() @MaxLength(240) line2?: string;
  @IsString() @MaxLength(20) postalCode!: string;
  @IsString() @MaxLength(120) city!: string;
  @IsOptional() @IsString() @MaxLength(120) province?: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/) country?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
