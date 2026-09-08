import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { AddressType } from "@prisma/client";
import { IsNotBlank } from "../../common/validation";

export class UpdateContactAddressDto {
  @IsOptional() @IsEnum(AddressType) type?: AddressType;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsString() @MaxLength(240) @IsNotBlank() line1?: string;
  @IsOptional() @IsString() @MaxLength(240) line2?: string;
  @IsOptional() @IsString() @MaxLength(20) @IsNotBlank() postalCode?: string;
  @IsOptional() @IsString() @MaxLength(120) @IsNotBlank() city?: string;
  @IsOptional() @IsString() @MaxLength(120) province?: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/) country?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
