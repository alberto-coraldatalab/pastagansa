import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DocumentSequencesController } from "./document-sequences.controller";
import { DocumentSequencesService } from "./document-sequences.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { InvoiceEmailService } from "./invoice-email.service";
import { InvoiceEmailOutboxWorker } from "./invoice-email-outbox.worker";
import { SmtpInvoiceMailer } from "./smtp-invoice-mailer.service";
import { TaxModule } from "../tax/tax.module";
import { AccountingModule } from "../accounting/accounting.module";
import { SifModule } from "../sif/sif.module";
import { QuotePdfService } from "../quotes/quote-pdf.service";

@Module({
  imports: [AuditModule, TaxModule, AccountingModule, SifModule],
  controllers: [DocumentSequencesController, InvoicesController],
  providers: [
    DocumentSequencesService,
    InvoicesService,
    InvoicePdfService,
    InvoiceEmailService,
    SmtpInvoiceMailer,
    InvoiceEmailOutboxWorker,
    QuotePdfService,
  ],
  exports: [InvoicesService, InvoiceEmailService],
})
export class InvoicesModule {}
