import {
  CommercialDocumentEventType,
  CommercialEventSource,
} from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateCommercialEventDto {
  @IsEnum(CommercialDocumentEventType)
  type!: CommercialDocumentEventType;

  @IsEnum(CommercialEventSource)
  source!: CommercialEventSource;

  @IsDateString()
  effectiveAt!: string;

  @IsOptional() @IsDateString()
  receivedAt?: string;

  @IsOptional() @IsString() @MaxLength(240)
  externalId?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  comment?: string;

  @IsOptional() @IsUUID()
  correctionOfId?: string;
}
