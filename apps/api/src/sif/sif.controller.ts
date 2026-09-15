import { Controller, Get, Query } from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { ListSifRecordsDto } from "./dto/list-sif-records.dto";
import { SifService } from "./sif.service";

@Controller("sif/records")
@TenantProtected()
export class SifController {
  constructor(private readonly sif: SifService) {}

  @Get("verification")
  @RequirePermissions("sif_record.read")
  verification() {
    return this.sif.verifyChain();
  }

  @Get()
  @RequirePermissions("sif_record.read")
  list(@Query() query: ListSifRecordsDto) {
    return this.sif.listForInvoice(query.invoiceId);
  }
}
