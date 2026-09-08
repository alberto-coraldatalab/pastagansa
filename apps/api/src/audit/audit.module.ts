import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AuditService } from './audit.service';

@Module({ imports: [TenancyModule], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
