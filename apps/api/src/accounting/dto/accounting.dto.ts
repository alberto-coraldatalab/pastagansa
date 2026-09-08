import { AccountClass, AccountingRole } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { IsNotBlank } from "../../common/validation";

export class CreateAccountDto {
  @IsString() @IsNotBlank() @MaxLength(20) code!: string;
  @IsString() @IsNotBlank() @MaxLength(240) name!: string;
  @IsEnum(AccountClass) accountClass!: AccountClass;
  @IsOptional() @IsEnum(AccountingRole) systemRole?: AccountingRole;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsBoolean() isReconcilable = false;
}

export class CreateFiscalYearDto {
  @IsString() @IsNotBlank() @MaxLength(20) code!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsBoolean() createMonthlyPeriods = true;
}

export class JournalLineDto {
  @IsUUID() accountId!: string;
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  debit = 0;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  credit = 0;
}

export class CreateJournalEntryDto {
  @IsDateString() entryDate!: string;
  @IsString() @IsNotBlank() @MaxLength(1000) description!: string;
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class ReverseJournalEntryDto {
  @IsDateString() entryDate!: string;
  @IsString() @IsNotBlank() @MaxLength(1000) reason!: string;
}
