import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { ApprovePurchaseInvoiceDto } from "./dto/approve-purchase-invoice.dto";
import { ListPurchaseInvoicesDto } from "./dto/list-purchase-invoices.dto";
import {
  CreatePurchaseInvoiceDto,
  UpdatePurchaseInvoiceDto,
} from "./dto/purchase-invoice.dto";
import { PurchasesService } from "./purchases.service";

@Controller("purchase-invoices")
@TenantProtected()
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  @RequirePermissions("purchase_invoice.read")
  list(@Query() query: ListPurchaseInvoicesDto) {
    return this.purchases.list(query);
  }

  @Get(":id")
  @RequirePermissions("purchase_invoice.read")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.purchases.get(id);
  }

  @Post()
  @RequirePermissions("purchase_invoice.create")
  create(@Body() input: CreatePurchaseInvoiceDto) {
    return this.purchases.create(input);
  }

  @Patch(":id")
  @RequirePermissions("purchase_invoice.update")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePurchaseInvoiceDto,
  ) {
    return this.purchases.update(id, input);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @RequirePermissions("purchase_invoice.approve")
  approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: ApprovePurchaseInvoiceDto,
  ) {
    return this.purchases.approve(
      id,
      input,
      requireIdempotencyKey(idempotencyKey),
    );
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions("purchase_invoice.delete")
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.purchases.delete(id);
  }
}

function requireIdempotencyKey(value: string | undefined) {
  const key = value?.trim();
  if (!key || key.length > 128 || /[\u0000-\u001f\u007f]/.test(key))
    throw new BadRequestException(
      "Idempotency-Key must contain between 1 and 128 printable characters",
    );
  return key;
}
