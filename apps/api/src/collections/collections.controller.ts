import { BadRequestException, Body, ConflictException, Controller, Get, Headers, HttpCode, Post, Query, StreamableFile } from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { CollectionsService } from "./collections.service";
import { CollectionsQueryDto } from "./dto/collections-query.dto";
import { PaymentReminderBatchDto } from "../invoices/dto/payment-reminder.dto";
import { InvoiceEmailService } from "../invoices/invoice-email.service";

@Controller("collections")
@TenantProtected()
export class CollectionsController {
  constructor(private readonly collections: CollectionsService, private readonly emails: InvoiceEmailService) {}
  @Get("summary") @RequirePermissions("collections.read") summary(@Query() query: CollectionsQueryDto) { return this.collections.summary(query); }
  @Get("invoices") @RequirePermissions("collections.read") invoices(@Query() query: CollectionsQueryDto) { return this.collections.invoices(query); }
  @Get("invoices.csv") @RequirePermissions("collections.read") async csv(@Query() query: CollectionsQueryDto) { const file = await this.collections.csv(query); return new StreamableFile(file.content, { type: "text/csv; charset=utf-8", disposition: `attachment; filename="${file.filename}"`, length: file.content.length }); }
  @Post("reminders/preview") @RequirePermissions("collections.read", "collections.manage") async previewReminders(@Body() input: PaymentReminderBatchDto) {
    const items = await Promise.all(input.invoiceIds.map((invoiceId) => this.previewReminder(invoiceId, input.template)));
    return { items, summary: summarize(items) };
  }
  @Post("reminders") @HttpCode(202) @RequirePermissions("collections.read", "collections.manage") async sendReminders(
    @Body() input: PaymentReminderBatchDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ) {
    if (!this.emails.capability().enabled) throw new ConflictException("Email delivery is not configured");
    const key = requireIdempotencyKey(idempotencyKey);
    const items = await Promise.all(input.invoiceIds.map(async (invoiceId) => {
      const preview = await this.previewReminder(invoiceId, input.template);
      if (preview.status === "SKIPPED") return preview;
      try {
        const delivery = await this.emails.enqueuePaymentReminder(invoiceId, input.template, `${key}:${invoiceId}`, undefined, true);
        return { invoiceId, status: delivery.status === "SENT" ? "SENT" : "QUEUED", deliveryId: delivery.id, recipient: delivery.recipient };
      } catch (error) {
        return { invoiceId, status: "SKIPPED", reason: error instanceof Error ? error.message : "No se pudo preparar el recordatorio", recipient: preview.recipient };
      }
    }));
    return { items, summary: summarize(items) };
  }

  private async previewReminder(invoiceId: string, template: PaymentReminderBatchDto["template"]) {
    try {
      const preview = await this.emails.previewPaymentReminder(invoiceId, template, undefined, true);
      return { invoiceId, status: preview.eligible ? "READY" : "SKIPPED", reason: preview.reason, recipient: preview.recipient, subject: preview.eligible ? preview.subject : null, body: preview.eligible ? preview.body : null, invoice: preview.invoice };
    } catch {
      return { invoiceId, status: "SKIPPED", reason: "La factura no está disponible para recordatorios", recipient: null, subject: null, body: null, invoice: null };
    }
  }
}

function summarize(items: Array<{ status: string; recipient?: string | null }>) { return { ready: items.filter((item) => item.status === "READY").length, queued: items.filter((item) => item.status === "QUEUED" || item.status === "SENT").length, skipped: items.filter((item) => item.status === "SKIPPED").length, recipients: new Set(items.flatMap((item) => item.recipient ? [item.recipient] : [])).size }; }
function requireIdempotencyKey(value: string | undefined) { const key = value?.trim(); if (!key || key.length > 80 || /[\u0000-\u001f\u007f]/.test(key)) throw new BadRequestException("Invalid idempotency key"); return key; }
