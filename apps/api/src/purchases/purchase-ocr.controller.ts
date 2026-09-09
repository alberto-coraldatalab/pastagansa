import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { ReviewPurchaseOcrDto } from "./dto/purchase-ocr.dto";
import { PurchaseOcrService } from "./purchase-ocr.service";

@Controller("purchase-invoices/:purchaseInvoiceId/ocr")
@TenantProtected()
export class PurchaseOcrController {
  constructor(private readonly ocr: PurchaseOcrService) {}

  @Get()
  @RequirePermissions("purchase_invoice.read")
  list(@Param("purchaseInvoiceId", ParseUUIDPipe) purchaseInvoiceId: string) {
    return this.ocr.list(purchaseInvoiceId);
  }

  @Get(":jobId")
  @RequirePermissions("purchase_invoice.read")
  get(
    @Param("purchaseInvoiceId", ParseUUIDPipe) purchaseInvoiceId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
  ) {
    return this.ocr.get(purchaseInvoiceId, jobId);
  }

  @Post("attachments/:attachmentId")
  @RequirePermissions("purchase_invoice.ocr")
  queue(
    @Param("purchaseInvoiceId", ParseUUIDPipe) purchaseInvoiceId: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
  ) {
    return this.ocr.queue(purchaseInvoiceId, attachmentId);
  }

  @Post(":jobId/review")
  @RequirePermissions("purchase_invoice.ocr")
  review(
    @Param("purchaseInvoiceId", ParseUUIDPipe) purchaseInvoiceId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: ReviewPurchaseOcrDto,
  ) {
    return this.ocr.review(purchaseInvoiceId, jobId, input);
  }
}
