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
import { CreateInvoiceDto, UpdateInvoiceDto } from "./dto/invoice.dto";
import { ListInvoicesDto } from "./dto/list-invoices.dto";
import { IssueInvoiceDto } from "./dto/issue-invoice.dto";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@TenantProtected()
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions("invoice.read")
  list(@Query() query: ListInvoicesDto) {
    return this.invoices.list(query);
  }

  @Get(":id")
  @RequirePermissions("invoice.read")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.get(id);
  }

  @Post()
  @RequirePermissions("invoice.create")
  create(@Body() input: CreateInvoiceDto) {
    return this.invoices.create(input);
  }

  @Patch(":id")
  @RequirePermissions("invoice.update")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateInvoiceDto,
  ) {
    return this.invoices.update(id, input);
  }

  @Post(":id/issue")
  @HttpCode(200)
  @RequirePermissions("invoice.issue")
  issue(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: IssueInvoiceDto,
  ) {
    return this.invoices.issue(
      id,
      input,
      requireIdempotencyKey(idempotencyKey),
    );
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions("invoice.delete")
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.delete(id);
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
