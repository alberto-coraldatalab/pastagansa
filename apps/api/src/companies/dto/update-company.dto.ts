import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  legalName?: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  baseCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
