import { BadRequestException, Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { TenantContextService } from "../tenancy/tenant-context.service";
import { SetPurchaseApprovalPolicyDto } from "./dto/purchase-approval.dto";

@Injectable()
export class PurchaseApprovalPolicyService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const tiers = await this.tenant.db.purchaseApprovalTier.findMany({
      where: this.scope(),
      orderBy: { minimumAmount: "asc" },
    });
    return tiers.length
      ? tiers
      : [{ minimumAmount: new Decimal(0), requiredApprovals: 1 }];
  }

  async set(input: SetPurchaseApprovalPolicyDto) {
    const tiers = input.tiers.map((tier) => ({
      minimumAmount: new Decimal(tier.minimumAmount),
      requiredApprovals: tier.requiredApprovals,
    }));
    if (!tiers[0].minimumAmount.isZero())
      throw new BadRequestException("The first tier must start at amount 0");
    for (let index = 1; index < tiers.length; index += 1) {
      if (
        !tiers[index].minimumAmount.greaterThan(tiers[index - 1].minimumAmount)
      )
        throw new BadRequestException(
          "Approval tier minimum amounts must be strictly increasing",
        );
      if (tiers[index].requiredApprovals < tiers[index - 1].requiredApprovals)
        throw new BadRequestException(
          "Higher approval tiers cannot require fewer approvers",
        );
    }
    const scope = this.scope();
    await this.tenant.db.$queryRaw`
      SELECT "id" FROM "companies"
      WHERE "id" = CAST(${scope.companyId} AS uuid)
        AND "organization_id" = CAST(${scope.organizationId} AS uuid)
      FOR UPDATE
    `;
    await this.tenant.db.purchaseApprovalTier.deleteMany({ where: scope });
    await this.tenant.db.purchaseApprovalTier.createMany({
      data: tiers.map((tier) => ({ ...scope, ...tier })),
    });
    await this.audit.record(
      "purchase_invoice.approval_policy_updated",
      "purchase_approval_policy",
      undefined,
      {
        tiers: tiers.map((tier) => ({
          minimumAmount: tier.minimumAmount.toFixed(2),
          requiredApprovals: tier.requiredApprovals,
        })),
      },
    );
    return this.get();
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}
