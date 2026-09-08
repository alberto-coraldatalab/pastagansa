import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  Min,
  ValidateNested,
} from "class-validator";

export class PaymentInstallmentDto {
  @IsDateString()
  dueDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class SetPaymentScheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => PaymentInstallmentDto)
  installments!: PaymentInstallmentDto[];
}
