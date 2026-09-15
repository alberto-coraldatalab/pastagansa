import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
@Module({ imports: [AuditModule], controllers: [CollectionsController], providers: [CollectionsService] })
export class CollectionsModule {}
