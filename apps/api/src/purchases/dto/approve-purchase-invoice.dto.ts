import { IsUUID } from "class-validator";

export class ApprovePurchaseInvoiceDto {
  @IsUUID() sequenceId!: string;
}
