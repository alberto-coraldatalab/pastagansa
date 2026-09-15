import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsOptional, IsUUID, MaxLength } from "class-validator";

export enum ReminderTemplate {
  DUE_SOON = "DUE_SOON",
  OVERDUE_FIRST = "OVERDUE_FIRST",
  OVERDUE_SECOND = "OVERDUE_SECOND",
}

export class PaymentReminderPreviewDto {
  @IsEnum(ReminderTemplate)
  template!: ReminderTemplate;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  recipient?: string;
}

export class PaymentReminderBatchDto {
  @IsEnum(ReminderTemplate)
  template!: ReminderTemplate;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  @Type(() => String)
  invoiceIds!: string[];
}
