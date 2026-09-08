import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { TenantContextService } from "../tenancy/tenant-context.service";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Injectable()
export class CompaniesService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async current() {
    const context = this.tenant.required;
    if (!context.companyId)
      throw new NotFoundException("x-company-id is required");
    const company = await this.tenant.db.company.findFirst({
      where: { id: context.companyId, organizationId: context.organizationId },
    });
    if (!company) throw new NotFoundException("Company not found");
    return company;
  }

  async update(input: UpdateCompanyDto) {
    const company = await this.current();
    const updated = await this.tenant.db.company.update({
      where: { id: company.id },
      data: input,
    });
    await this.audit.record("company.updated", "company", company.id, {
      changedFields: Object.keys(input),
    });
    return updated;
  }
}
