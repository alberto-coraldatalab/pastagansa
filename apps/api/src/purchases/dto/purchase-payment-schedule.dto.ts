import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";

export class PurchaseInstallmentDto {
  @IsDateString()
  dueDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class SetPurchasePaymentScheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => PurchaseInstallmentDto)
  installments!: PurchaseInstallmentDto[];
}

export class PurchasePaymentScheduleQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
