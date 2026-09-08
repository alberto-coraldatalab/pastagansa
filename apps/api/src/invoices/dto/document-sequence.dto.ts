import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { DocumentType } from "@prisma/client";
import { IsNotBlank } from "../../common/validation";

export class CreateDocumentSequenceDto {
  @IsEnum(DocumentType) documentType!: DocumentType;
  @IsString()
  @IsNotBlank()
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
  series!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  startingNumber = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) padding = 4;
}

export class UpdateDocumentSequenceDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) padding?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
