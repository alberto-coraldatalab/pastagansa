import { Controller, Get, Query, StreamableFile } from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { CollectionsService } from "./collections.service";
import { CollectionsQueryDto } from "./dto/collections-query.dto";

@Controller("collections")
@TenantProtected()
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}
  @Get("summary") @RequirePermissions("collections.read") summary(@Query() query: CollectionsQueryDto) { return this.collections.summary(query); }
  @Get("invoices") @RequirePermissions("collections.read") invoices(@Query() query: CollectionsQueryDto) { return this.collections.invoices(query); }
  @Get("invoices.csv") @RequirePermissions("collections.read") async csv(@Query() query: CollectionsQueryDto) { const file = await this.collections.csv(query); return new StreamableFile(file.content, { type: "text/csv; charset=utf-8", disposition: `attachment; filename="${file.filename}"`, length: file.content.length }); }
}
