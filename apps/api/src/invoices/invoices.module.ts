import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DocumentSequencesController } from "./document-sequences.controller";
import { DocumentSequencesService } from "./document-sequences.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [AuditModule],
  controllers: [DocumentSequencesController, InvoicesController],
  providers: [DocumentSequencesService, InvoicesService],
})
export class InvoicesModule {}
