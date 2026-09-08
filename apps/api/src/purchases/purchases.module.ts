import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TaxModule } from "../tax/tax.module";
import { AccountingModule } from "../accounting/accounting.module";
import { PurchasesController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";
import { SupplierPaymentsService } from "./supplier-payments.service";

@Module({
  imports: [AuditModule, TaxModule, AccountingModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, SupplierPaymentsService],
})
export class PurchasesModule {}
