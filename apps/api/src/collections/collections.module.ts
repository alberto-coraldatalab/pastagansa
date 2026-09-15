import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
@Module({ imports: [AuditModule, InvoicesModule], controllers: [CollectionsController], providers: [CollectionsService] })
export class CollectionsModule {}
