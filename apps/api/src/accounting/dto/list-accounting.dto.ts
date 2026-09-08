import { JournalSourceType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ListJournalEntriesDto {
  @IsOptional() @IsEnum(JournalSourceType) sourceType?: JournalSourceType;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(500) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}

export class TrialBalanceDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}
