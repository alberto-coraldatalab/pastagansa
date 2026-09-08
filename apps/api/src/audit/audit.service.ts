import { Injectable } from '@nestjs/common';
import { Prisma, AuditEvent } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService) {}

  async record(action: string, entityType: string, entityId?: string, metadata: Prisma.InputJsonValue = {}): Promise<AuditEvent> {
    const context = this.tenant.required;
    return this.prisma.auditEvent.create({
      data: { organizationId: context.organizationId, companyId: context.companyId, actorUserId: context.userId, action, entityType, entityId, metadata },
    });
  }
}
