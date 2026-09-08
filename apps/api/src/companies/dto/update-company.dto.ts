import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { IsCurrencyCode, IsNotBlank } from "../../common/validation";

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  @IsNotBlank()
  legalName?: string;

  @IsOptional()
  @IsCurrencyCode()
  baseCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
