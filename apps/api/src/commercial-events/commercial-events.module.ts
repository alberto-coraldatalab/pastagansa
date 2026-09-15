import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CommercialEventsService } from "./commercial-events.service";

@Module({ imports: [AuditModule], providers: [CommercialEventsService], exports: [CommercialEventsService] })
export class CommercialEventsModule {}
