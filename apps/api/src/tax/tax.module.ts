import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";

@Module({
  imports: [AuditModule],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
