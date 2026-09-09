import { IsObject, IsString, MaxLength } from "class-validator";
import { IsNotBlank } from "../../common/validation";

export class ReviewPurchaseOcrDto {
  @IsObject()
  fields!: Record<string, unknown>;

  @IsString()
  @IsNotBlank()
  @MaxLength(1000)
  notes!: string;
}
