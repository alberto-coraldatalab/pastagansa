import { IsString, MaxLength } from "class-validator";

export class ImportContactsDto {
  @IsString()
  @MaxLength(1_000_000)
  csv!: string;
}
