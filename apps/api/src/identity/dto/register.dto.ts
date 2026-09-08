import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MaxLength(160)
  organizationName!: string;

  @IsString()
  @MaxLength(240)
  legalName!: string;

  @Matches(/^[A-Za-z0-9][A-Za-z0-9 -]{1,38}[A-Za-z0-9]$/)
  taxId!: string;
}
