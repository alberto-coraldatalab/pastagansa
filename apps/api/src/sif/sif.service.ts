import { ConflictException, Injectable } from "@nestjs/common";
import {
  DocumentType,
  InvoiceStatus,
  Prisma,
  RectificationImpact,
  SifRecord,
  SifRecordType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { TenantContextService } from "../tenancy/tenant-context.service";
import {
  formatSifIssueDate,
  formatSifTimestamp,
  hashSifRegistration,
  SIF_HASH_SPECIFICATION_VERSION,
} from "./sif-hash-v1";

@Injectable()
export class SifService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async listForInvoice(invoiceId: string) {
    return (
      await this.tenant.db.sifRecord.findMany({
        where: { invoiceId, ...this.scope() },
        orderBy: { chainPosition: "asc" },
      })
    ).map(presentSifRecord);
  }

  async createRegistration(invoiceId: string) {
    const scope = this.scope();
    await this.tenant.db.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${scope.companyId}, 0))
    `;
    const existing = await this.tenant.db.sifRecord.findFirst({
      where: {
        invoiceId,
        recordType: SifRecordType.REGISTRATION,
        ...scope,
      },
    });
    if (existing) return presentSifRecord(existing);

    const invoice = await this.tenant.db.invoice.findFirst({
      where: { id: invoiceId, ...scope },
      select: {
        id: true,
        documentType: true,
        rectificationImpact: true,
        issuerTaxId: true,
        fullNumber: true,
        issueDate: true,
        taxTotal: true,
        total: true,
        status: true,
        company: { select: { timezone: true } },
      },
    });
    if (
      !invoice ||
      invoice.status === InvoiceStatus.DRAFT ||
      !invoice.fullNumber
    )
      throw new ConflictException(
        "Only issued invoices can generate a SIF registration",
      );

    const previous = await this.tenant.db.sifRecord.findFirst({
      where: scope,
      orderBy: { chainPosition: "desc" },
    });
    const generatedAt = new Date(Math.floor(Date.now() / 1_000) * 1_000);
    const sign =
      invoice.documentType === DocumentType.CREDIT_NOTE &&
      invoice.rectificationImpact === RectificationImpact.DECREASE
        ? new Decimal(-1)
        : new Decimal(1);
    const hashInput = {
      issuerTaxId: invoice.issuerTaxId,
      invoiceNumber: invoice.fullNumber,
      issueDate: formatSifIssueDate(invoice.issueDate),
      invoiceType:
        invoice.documentType === DocumentType.CREDIT_NOTE ? "R4" : "F1",
      taxTotal: invoice.taxTotal.mul(sign).toFixed(2),
      total: invoice.total.mul(sign).toFixed(2),
      previousHash: previous?.recordHash ?? "",
      generatedAt: formatSifTimestamp(generatedAt, invoice.company.timezone),
    };
    const recordHash = hashSifRegistration(hashInput);
    const payload: Prisma.InputJsonObject = {
      hashInput,
      firstRecord: previous === null,
      previousRecord: previous
        ? {
            issuerTaxId: previous.issuerTaxId,
            invoiceNumber: previous.invoiceNumber,
            issueDate: formatSifIssueDate(previous.invoiceIssueDate),
            hash: previous.recordHash,
          }
        : null,
    };
    const record = await this.tenant.db.sifRecord.create({
      data: {
        ...scope,
        invoiceId: invoice.id,
        recordType: SifRecordType.REGISTRATION,
        chainPosition: (previous?.chainPosition ?? 0n) + 1n,
        issuerTaxId: hashInput.issuerTaxId,
        invoiceNumber: hashInput.invoiceNumber,
        invoiceIssueDate: invoice.issueDate,
        invoiceType: hashInput.invoiceType,
        taxTotal: hashInput.taxTotal,
        total: hashInput.total,
        generatedAt,
        previousRecordId: previous?.id,
        previousRecordHash: previous?.recordHash,
        recordHash,
        specificationVersion: SIF_HASH_SPECIFICATION_VERSION,
        payload,
      },
    });
    await this.audit.record("sif_record.registered", "sif_record", record.id, {
      invoiceId: invoice.id,
      chainPosition: record.chainPosition.toString(),
      recordHash,
      specificationVersion: SIF_HASH_SPECIFICATION_VERSION,
    });
    return presentSifRecord(record);
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new Error("Company context is required");
    return { organizationId, companyId };
  }
}

function presentSifRecord(record: SifRecord) {
  return { ...record, chainPosition: record.chainPosition.toString() };
}
