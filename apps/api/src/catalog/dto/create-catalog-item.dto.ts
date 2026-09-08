import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { CatalogItemType } from "@prisma/client";
import { IsCurrencyCode, IsNotBlank } from "../../common/validation";

export class CreateCatalogItemDto {
  @IsEnum(CatalogItemType) type!: CatalogItemType;
  @IsOptional() @IsString() @MaxLength(80) sku?: string;
  @IsString() @MaxLength(240) @IsNotBlank() name!: string;
  @IsOptional() @IsString() @MaxLength(4_000) description?: string;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salesPrice?: number;
  @IsOptional() @IsCurrencyCode() currency?: string;
  @IsOptional() @IsString() @MaxLength(80) suggestedTaxCode?: string;
  @IsOptional() @IsString() @MaxLength(20) revenueAccountCode?: string;
  @IsOptional() @IsString() @MaxLength(20) expenseAccountCode?: string;
  @IsOptional() @IsBoolean() trackInventory?: boolean;
}
