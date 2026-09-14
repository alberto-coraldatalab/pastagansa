import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { QuotesController } from "./quotes.controller";
import { QuotePdfService } from "./quote-pdf.service";
import { QuotesService } from "./quotes.service";
@Module({
  imports: [AuditModule, InvoicesModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuotePdfService],
})
export class QuotesModule {}
