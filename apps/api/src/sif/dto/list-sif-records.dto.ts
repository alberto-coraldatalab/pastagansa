import { IsUUID } from "class-validator";

export class ListSifRecordsDto {
  @IsUUID() invoiceId!: string;
}
