import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { QuotesController } from "./quotes.controller";
import { QuotePdfService } from "./quote-pdf.service";
import { QuotesService } from "./quotes.service";
@Module({
  imports: [AuditModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuotePdfService],
})
export class QuotesModule {}
