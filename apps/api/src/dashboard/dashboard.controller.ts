import { Controller, Get } from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@TenantProtected()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  @RequirePermissions("invoice.read", "purchase_invoice.read")
  summary() {
    return this.dashboard.summary();
  }
}
