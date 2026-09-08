import { IsUUID } from "class-validator";

export class IssueInvoiceDto {
  @IsUUID() sequenceId!: string;
}
