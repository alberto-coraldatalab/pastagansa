import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";
import { SifDeclarationPdfService } from "../sif/sif-declaration-pdf.service";

@Module({
  imports: [AuditModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, SifDeclarationPdfService],
})
export class CompaniesModule {}
