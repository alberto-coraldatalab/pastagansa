import { RectificationImpact, RectificationKind } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { InvoiceLineDto } from "./invoice.dto";

export class CreateRectificationDto {
  @IsEnum(RectificationKind)
  kind!: RectificationKind;

  @IsEnum(RectificationImpact)
  impact!: RectificationImpact;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];
}
