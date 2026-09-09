import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TaxModule } from "../tax/tax.module";
import { AccountingModule } from "../accounting/accounting.module";
import { PurchasesController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";
import { SupplierPaymentsService } from "./supplier-payments.service";
import { PurchaseAttachmentsService } from "./purchase-attachments.service";
import { PurchaseApprovalPolicyController } from "./purchase-approval-policy.controller";
import { PurchaseApprovalPolicyService } from "./purchase-approval-policy.service";
import { PurchaseOcrController } from "./purchase-ocr.controller";
import { PurchaseOcrEngine } from "./purchase-ocr-engine.service";
import { PurchaseOcrService } from "./purchase-ocr.service";
import { PurchaseOcrWorker } from "./purchase-ocr.worker";

@Module({
  imports: [AuditModule, TaxModule, AccountingModule],
  controllers: [
    PurchasesController,
    PurchaseApprovalPolicyController,
    PurchaseOcrController,
  ],
  providers: [
    PurchasesService,
    SupplierPaymentsService,
    PurchaseAttachmentsService,
    PurchaseApprovalPolicyService,
    PurchaseOcrService,
    PurchaseOcrEngine,
    PurchaseOcrWorker,
  ],
})
export class PurchasesModule {}
