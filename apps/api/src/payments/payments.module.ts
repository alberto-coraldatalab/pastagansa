import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { AuditModule } from "../audit/audit.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [AuditModule, AccountingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
