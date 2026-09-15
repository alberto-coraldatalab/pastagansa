import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import {
  ChangeQuoteStatusDto,
  CreateQuoteDto,
  UpdateQuoteDto,
} from "./dto/quote.dto";
import { QuotesService } from "./quotes.service";
import { ListQuotesDto } from "./dto/list-quotes.dto";
import { ConvertQuoteDto } from "./dto/convert-quote.dto";
import { SendDocumentEmailDto } from "../invoices/dto/send-invoice-email.dto";
import { InvoiceEmailService } from "../invoices/invoice-email.service";
import { CommercialEventsService } from "../commercial-events/commercial-events.service";
import { CreateCommercialEventDto } from "../commercial-events/dto/create-commercial-event.dto";
import { ListCommercialEventsDto } from "../commercial-events/dto/list-commercial-events.dto";
@Controller("quotes")
@TenantProtected()
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly emails: InvoiceEmailService,
    private readonly commercialEvents: CommercialEventsService,
  ) {}
  @Get() @RequirePermissions("quote.read") list(@Query() query: ListQuotesDto) {
    return this.quotes.list(query);
  }
  @Get("email-capability") @RequirePermissions("quote.read") emailCapability() {
    return this.emails.capability();
  }
  @Get(":id") @RequirePermissions("quote.read") get(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.quotes.get(id);
  }
  @Get(":id/pdf")
  @RequirePermissions("quote.read")
  async pdf(@Param("id", ParseUUIDPipe) id: string) {
    const file = await this.quotes.downloadPdf(id);
    return new StreamableFile(file.content, {
      type: "application/pdf",
      disposition: `attachment; filename="${file.filename}"`,
      length: file.content.length,
    });
  }
  @Get(":id/email-deliveries") @RequirePermissions("quote.read") deliveries(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.emails.listQuote(id);
  }
  @Get(":id/commercial-events") @RequirePermissions("quote.read", "collections.read") commercialEventsList(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ListCommercialEventsDto,
  ) {
    return this.commercialEvents.listQuote(id, query);
  }
  @Post() @RequirePermissions("quote.create") create(
    @Body() input: CreateQuoteDto,
  ) {
    return this.quotes.create(input);
  }
  @Post(":id/email")
  @HttpCode(202)
  @RequirePermissions("document.send")
  email(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: SendDocumentEmailDto,
  ) {
    return this.emails.enqueueQuote(id, input, requireIdempotencyKey(idempotencyKey));
  }
  @Post(":id/commercial-events")
  @HttpCode(201)
  @RequirePermissions("quote.read", "quotes.manage")
  commercialEvent(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CreateCommercialEventDto,
  ) {
    return this.commercialEvents.recordQuote(id, input);
  }
  @Patch(":id") @RequirePermissions("quote.update") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateQuoteDto,
  ) {
    return this.quotes.update(id, input);
  }
  @Post(":id/status")
  @HttpCode(200)
  @RequirePermissions("quote.change_status")
  status(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ChangeQuoteStatusDto,
  ) {
    return this.quotes.changeStatus(id, input.status, input.expectedStatus);
  }
  @Post(":id/convert-to-invoice")
  @HttpCode(200)
  @RequirePermissions("quote.change_status", "invoice.create")
  convertToInvoice(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ConvertQuoteDto,
  ) {
    return this.quotes.convertToInvoice(id, input);
  }
}

function requireIdempotencyKey(value: string | undefined) {
  const key = value?.trim();
  if (!key || key.length > 128 || /[\u0000-\u001f\u007f]/.test(key))
    throw new BadRequestException("Idempotency-Key must contain between 1 and 128 printable characters");
  return key;
}
