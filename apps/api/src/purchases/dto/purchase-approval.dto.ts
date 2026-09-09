import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { IsNotBlank } from "../../common/validation";

export class PurchaseApprovalTierDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumAmount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  requiredApprovals!: number;
}

export class SetPurchaseApprovalPolicyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PurchaseApprovalTierDto)
  tiers!: PurchaseApprovalTierDto[];
}

export class RejectPurchaseInvoiceDto {
  @IsString()
  @IsNotBlank()
  @MaxLength(1000)
  reason!: string;
}
