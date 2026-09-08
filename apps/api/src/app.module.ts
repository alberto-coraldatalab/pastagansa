import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuditModule } from "./audit/audit.module";
import { AuthorizationModule } from "./authorization/authorization.module";
import { CompaniesModule } from "./companies/companies.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ContactsModule } from "./contacts/contacts.module";
import { QuotesModule } from "./quotes/quotes.module";
import { HealthController } from "./health.controller";
import { IdentityModule } from "./identity/identity.module";
import { PrismaModule } from "./prisma.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PlatformModule } from "./platform/platform.module";
import { validateConfiguration } from "./configuration";
import { InvoicesModule } from "./invoices/invoices.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfiguration }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    IdentityModule,
    TenancyModule,
    AuthorizationModule,
    PlatformModule,
    AuditModule,
    CompaniesModule,
    ContactsModule,
    CatalogModule,
    QuotesModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
