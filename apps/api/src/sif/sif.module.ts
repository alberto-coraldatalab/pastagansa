import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { SifController } from "./sif.controller";
import { SifService } from "./sif.service";

@Module({
  imports: [AuditModule],
  controllers: [SifController],
  providers: [SifService],
  exports: [SifService],
})
export class SifModule {}
