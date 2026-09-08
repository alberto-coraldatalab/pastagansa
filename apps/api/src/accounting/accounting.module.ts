import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AccountingController } from "./accounting.controller";
import { AccountingReportsController } from "./accounting-reports.controller";
import { AccountingReportsService } from "./accounting-reports.service";
import { AccountingService } from "./accounting.service";

@Module({
  imports: [AuditModule],
  controllers: [AccountingController, AccountingReportsController],
  providers: [AccountingService, AccountingReportsService],
  exports: [AccountingService],
})
export class AccountingModule {}
