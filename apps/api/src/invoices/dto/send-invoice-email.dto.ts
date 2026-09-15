import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";
import { IsNotBlank } from "../../common/validation";

export class SendDocumentEmailDto {
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

/** @deprecated Kept as an import-stable name for invoice API clients. */
export class SendInvoiceEmailDto extends SendDocumentEmailDto {}
