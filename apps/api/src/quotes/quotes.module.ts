import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { QuotesController } from "./quotes.controller";
import { QuotePdfService } from "./quote-pdf.service";
import { QuotesService } from "./quotes.service";
import { CommercialEventsModule } from "../commercial-events/commercial-events.module";
@Module({
  imports: [AuditModule, InvoicesModule, CommercialEventsModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuotePdfService],
})
export class QuotesModule {}
