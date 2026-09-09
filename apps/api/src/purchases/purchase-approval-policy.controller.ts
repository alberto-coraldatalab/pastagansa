import { Body, Controller, Get, Put } from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { SetPurchaseApprovalPolicyDto } from "./dto/purchase-approval.dto";
import { PurchaseApprovalPolicyService } from "./purchase-approval-policy.service";

@Controller("purchase-approval-policy")
@TenantProtected()
export class PurchaseApprovalPolicyController {
  constructor(private readonly policy: PurchaseApprovalPolicyService) {}

  @Get()
  @RequirePermissions("purchase_invoice.read")
  get() {
    return this.policy.get();
  }

  @Put()
  @RequirePermissions("purchase_invoice.approval_policy.manage")
  set(@Body() input: SetPurchaseApprovalPolicyDto) {
    return this.policy.set(input);
  }
}
