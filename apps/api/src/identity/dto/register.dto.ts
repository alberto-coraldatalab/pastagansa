import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { IsNotBlank, IsSpanishTaxId } from "../../common/validation";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MaxLength(160)
  @IsNotBlank()
  organizationName!: string;

  @IsString()
  @MaxLength(240)
  @IsNotBlank()
  legalName!: string;

  @IsSpanishTaxId()
  taxId!: string;
}
