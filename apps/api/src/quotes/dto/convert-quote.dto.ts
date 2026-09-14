import { IsDateString, IsOptional } from "class-validator";

export class ConvertQuoteDto {
  @IsDateString() issueDate!: string;
  @IsOptional() @IsDateString() dueDate?: string;
}
