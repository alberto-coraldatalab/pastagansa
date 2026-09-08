import { IsUUID } from "class-validator";

export class UpdateAccountingRuleDto {
  @IsUUID() accountId!: string;
}
