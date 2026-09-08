import {
  Body,
  Controller,
  Get,
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
@Controller("quotes")
@TenantProtected()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}
  @Get() @RequirePermissions("quote.read") list(@Query() query: ListQuotesDto) {
    return this.quotes.list(query);
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
  @Post() @RequirePermissions("quote.create") create(
    @Body() input: CreateQuoteDto,
  ) {
    return this.quotes.create(input);
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
}
