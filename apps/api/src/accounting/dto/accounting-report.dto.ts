import { JournalSourceType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator";

export class JournalReportDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsEnum(JournalSourceType) sourceType?: JournalSourceType;
}

export class GeneralLedgerReportDto {
  @IsUUID() accountId!: string;
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}
