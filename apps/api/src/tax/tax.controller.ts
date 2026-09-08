import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { ListTaxLedgerDto } from "./dto/list-tax-ledger.dto";
import { ListTaxRulesDto } from "./dto/list-tax-rules.dto";
import { TaxService } from "./tax.service";

@Controller()
@TenantProtected()
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get("tax-rules")
  @RequirePermissions("tax_rule.read")
  rules(@Query() query: ListTaxRulesDto) {
    return this.tax.listRules(query);
  }

  @Get("tax-ledger")
  @RequirePermissions("tax_ledger.read")
  ledger(@Query() query: ListTaxLedgerDto) {
    return this.tax.listLedger(query);
  }

  @Get("tax-ledger/:id")
  @RequirePermissions("tax_ledger.read")
  entry(@Param("id", ParseUUIDPipe) id: string) {
    return this.tax.getLedgerEntry(id);
  }
}
