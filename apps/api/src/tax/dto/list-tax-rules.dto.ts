import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class ListTaxRulesDto {
  @IsDateString()
  effectiveOn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  jurisdiction = "ES";
}
