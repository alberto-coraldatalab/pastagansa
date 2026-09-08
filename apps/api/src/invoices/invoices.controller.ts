import {
  Body,
  Controller,
  Delete,
  Get,
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

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions("invoice.delete")
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.delete(id);
  }
}
