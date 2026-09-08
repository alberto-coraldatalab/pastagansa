import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BankingController } from "./banking.controller";
import { BankingService } from "./banking.service";

@Module({
  imports: [AuditModule],
  controllers: [BankingController],
  providers: [BankingService],
})
export class BankingModule {}
