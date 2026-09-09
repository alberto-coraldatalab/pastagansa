import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  PurchaseInvoiceStatus,
  PurchaseOcrStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { TenantContextService } from "../tenancy/tenant-context.service";
import { ReviewPurchaseOcrDto } from "./dto/purchase-ocr.dto";

const allowedReviewFields = new Set([
  "supplierName",
  "taxId",
  "invoiceNumber",
  "issueDate",
  "taxableBase",
  "taxAmount",
  "total",
  "dueDate",
  "iban",
]);

@Injectable()
export class PurchaseOcrService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async list(purchaseInvoiceId: string) {
    await this.requirePurchase(purchaseInvoiceId);
    return this.tenant.db.purchaseInvoiceOcrJob.findMany({
      where: { purchaseInvoiceId, ...this.scope() },
      select: jobSummary,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async get(purchaseInvoiceId: string, jobId: string) {
    await this.requirePurchase(purchaseInvoiceId);
    const job = await this.tenant.db.purchaseInvoiceOcrJob.findFirst({
      where: { id: jobId, purchaseInvoiceId, ...this.scope() },
      include: {
        attachment: {
          select: { id: true, originalName: true, mediaType: true },
        },
        reviewedBy: { select: { id: true, email: true } },
      },
    });
    if (!job) throw new NotFoundException("OCR job not found");
    return job;
  }

  async queue(purchaseInvoiceId: string, attachmentId: string) {
    const scope = this.scope();
    await this.lockPurchase(purchaseInvoiceId);
    const purchase = await this.requirePurchase(purchaseInvoiceId);
    if (purchase.status !== PurchaseInvoiceStatus.DRAFT)
      throw new ConflictException(
        "OCR can only be requested for draft purchase invoices",
      );
    const attachment = await this.tenant.db.purchaseInvoiceAttachment.findFirst(
      {
        where: { id: attachmentId, purchaseInvoiceId, ...scope },
        select: { mediaType: true },
      },
    );
    if (!attachment) throw new NotFoundException("Attachment not found");
    if (!["image/png", "image/jpeg"].includes(attachment.mediaType))
      throw new BadRequestException(
        "Local OCR supports PNG and JPEG attachments; PDF requires a configured PDF-capable provider",
      );
    const existing = await this.tenant.db.purchaseInvoiceOcrJob.findUnique({
      where: { attachmentId },
    });
    if (existing && existing.status !== PurchaseOcrStatus.FAILED)
      throw new ConflictException("This attachment already has an OCR job");
    const job = existing
      ? await this.tenant.db.purchaseInvoiceOcrJob.update({
          where: { id: existing.id },
          data: {
            status: PurchaseOcrStatus.PENDING,
            attempts: 0,
            availableAt: new Date(),
            lockedAt: null,
            lastError: null,
            rawText: null,
            extractedFields: Prisma.DbNull,
            overallConfidence: null,
          },
          select: jobSummary,
        })
      : await this.tenant.db.purchaseInvoiceOcrJob.create({
          data: {
            ...scope,
            purchaseInvoiceId,
            attachmentId,
            requestedById: this.tenant.required.userId,
          },
          select: jobSummary,
        });
    await this.audit.record(
      "purchase_invoice.ocr_requested",
      "purchase_invoice_ocr_job",
      job.id,
      { purchaseInvoiceId, attachmentId },
    );
    return job;
  }

  async review(
    purchaseInvoiceId: string,
    jobId: string,
    input: ReviewPurchaseOcrDto,
  ) {
    const scope = this.scope();
    await this.lockPurchase(purchaseInvoiceId);
    const purchase = await this.requirePurchase(purchaseInvoiceId);
    if (purchase.status !== PurchaseInvoiceStatus.DRAFT)
      throw new ConflictException(
        "OCR can only be reviewed for draft purchase invoices",
      );
    const invalid = Object.keys(input.fields).filter(
      (key) => !allowedReviewFields.has(key),
    );
    if (invalid.length)
      throw new BadRequestException(
        `Unsupported OCR review fields: ${invalid.join(", ")}`,
      );
    for (const value of Object.values(input.fields)) {
      if (value !== null && (typeof value !== "string" || value.length > 500))
        throw new BadRequestException(
          "OCR review field values must be strings, null, and at most 500 characters",
        );
    }
    const updated = await this.tenant.db.purchaseInvoiceOcrJob.updateMany({
      where: {
        id: jobId,
        purchaseInvoiceId,
        status: PurchaseOcrStatus.REVIEW_REQUIRED,
        ...scope,
      },
      data: {
        status: PurchaseOcrStatus.REVIEWED,
        reviewFields: {
          fields: input.fields as Prisma.InputJsonObject,
          notes: input.notes.trim(),
        },
        reviewedById: this.tenant.required.userId,
        reviewedAt: new Date(),
      },
    });
    if (!updated.count)
      throw new ConflictException(
        "OCR job was not found or is not awaiting review",
      );
    await this.audit.record(
      "purchase_invoice.ocr_reviewed",
      "purchase_invoice_ocr_job",
      jobId,
      { purchaseInvoiceId, correctedFields: Object.keys(input.fields) },
    );
    return this.get(purchaseInvoiceId, jobId);
  }

  private async lockPurchase(id: string) {
    const scope = this.scope();
    const locked = await this.tenant.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "purchase_invoices"
      WHERE "id" = CAST(${id} AS uuid)
        AND "organization_id" = CAST(${scope.organizationId} AS uuid)
        AND "company_id" = CAST(${scope.companyId} AS uuid)
      FOR UPDATE
    `;
    if (!locked.length)
      throw new NotFoundException("Purchase invoice not found");
  }

  private async requirePurchase(id: string) {
    const purchase = await this.tenant.db.purchaseInvoice.findFirst({
      where: { id, ...this.scope() },
      select: { status: true },
    });
    if (!purchase) throw new NotFoundException("Purchase invoice not found");
    return purchase;
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}

const jobSummary = {
  id: true,
  purchaseInvoiceId: true,
  attachmentId: true,
  status: true,
  engine: true,
  engineVersion: true,
  overallConfidence: true,
  attempts: true,
  lastError: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PurchaseInvoiceOcrJobSelect;
