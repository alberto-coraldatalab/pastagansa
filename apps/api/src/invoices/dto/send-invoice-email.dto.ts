import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";
import { IsNotBlank } from "../../common/validation";

export class SendInvoiceEmailDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  recipient?: string;

  @IsOptional()
  @IsString()
  @IsNotBlank()
  @MaxLength(300)
  subject?: string;
}
