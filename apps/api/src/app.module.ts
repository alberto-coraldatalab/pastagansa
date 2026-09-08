import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health.controller';
import { IdentityModule } from './identity/identity.module';
import { PrismaModule } from './prisma.module';
import { TenancyModule } from './tenancy/tenancy.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, IdentityModule, TenancyModule, AuditModule],
  controllers: [HealthController],
})
export class AppModule {}
