import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DocumentType,
  InvoiceStatus,
  Prisma,
  RectificationImpact,
  TaxBookType,
  TaxLedgerAmount,
  TaxLedgerDirection,
  TaxLedgerEntry,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { decodeCursor, encodeCursor } from "../common/cursor";
import { TenantContextService } from "../tenancy/tenant-context.service";
import { ListTaxLedgerDto } from "./dto/list-tax-ledger.dto";
import { ListTaxRulesDto } from "./dto/list-tax-rules.dto";

@Injectable()
export class TaxService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async listRules(query: ListTaxRulesDto) {
    const effectiveOn = new Date(query.effectiveOn);
    return this.tenant.db.taxRule.findMany({
      where: {
        jurisdiction: query.jurisdiction.toUpperCase(),
        effectiveFrom: { lte: effectiveOn },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveOn } }],
      },
      orderBy: [{ taxFamily: "asc" }, { rate: "desc" }, { code: "asc" }],
    });
  }

  async listLedger(query: ListTaxLedgerDto) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException("from cannot be after to");
    const filter = JSON.stringify({
      direction: query.direction ?? null,
      bookType: query.bookType ?? null,
      from: query.from ?? null,
      to: query.to ?? null,
    });
    const cursor = query.cursor
      ? decodeCursor(query.cursor, filter)
      : undefined;
    const scope = this.scope();
    if (cursor) {
      const exists = await this.tenant.db.taxLedgerEntry.findFirst({
        where: {
          id: cursor.id,
          taxPointDate: new Date(cursor.sort),
          ...scope,
          ...this.ledgerFilters(query),
        },
        select: { id: true },
      });
      if (!exists)
        throw new BadRequestException(
          "Cursor is stale or does not belong to the selected company",
        );
    }
    const entries = await this.tenant.db.taxLedgerEntry.findMany({
      where: { ...scope, ...this.ledgerFilters(query) },
      include: { amounts: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ taxPointDate: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = entries.length > query.limit;
    const data = hasMore ? entries.slice(0, -1) : entries;
    const last = data.at(-1);
    return {
      data,
      nextCursor:
        hasMore && last
          ? encodeCursor(last.id, last.taxPointDate.toISOString(), filter)
          : null,
    };
  }

  async getLedgerEntry(id: string) {
    const entry = await this.tenant.db.taxLedgerEntry.findFirst({
      where: { id, ...this.scope() },
      include: {
        amounts: { orderBy: { createdAt: "asc" } },
        correctionOf: { select: { id: true, documentNumber: true } },
      },
    });
    if (!entry) throw new NotFoundException("Tax ledger entry not found");
    return entry;
  }

  async postInvoice(
    invoiceId: string,
  ): Promise<TaxLedgerEntry & { amounts: TaxLedgerAmount[] }> {
    const scope = this.scope();
    const existing = await this.tenant.db.taxLedgerEntry.findFirst({
      where: { invoiceId, ...scope },
      include: { amounts: true },
    });
    if (existing) return existing;
    const invoice = await this.tenant.db.invoice.findFirst({
      where: { id: invoiceId, ...scope },
      include: {
        lines: { include: { taxLines: true } },
        originalInvoice: {
          select: { id: true, taxLedgerEntry: { select: { id: true } } },
        },
      },
    });
    if (
      !invoice ||
      invoice.status === InvoiceStatus.DRAFT ||
      !invoice.fullNumber
    )
      throw new ConflictException("Only issued invoices can enter Tax Ledger");
    if (
      invoice.lines.length === 0 ||
      invoice.lines.some((line) => line.taxLines.length !== 1)
    )
      throw new ConflictException(
        "Every invoice line must have exactly one fiscal breakdown",
      );
    let correctionOfId = invoice.originalInvoice?.taxLedgerEntry?.id ?? null;
    if (invoice.originalInvoice && !correctionOfId) {
      correctionOfId = (await this.postInvoice(invoice.originalInvoice.id)).id;
    }
    const sign =
      invoice.documentType === DocumentType.CREDIT_NOTE &&
      invoice.rectificationImpact === RectificationImpact.DECREASE
        ? new Decimal(-1)
        : new Decimal(1);
    const taxLines = invoice.lines.map((line) => line.taxLines[0]);
    const entry = await this.tenant.db.taxLedgerEntry.create({
      data: {
        ...scope,
        invoiceId: invoice.id,
        direction: TaxLedgerDirection.SALES,
        bookType: TaxBookType.ISSUED_INVOICES,
        issueDate: invoice.issueDate,
        operationDate: invoice.issueDate,
        taxPointDate: invoice.issueDate,
        counterpartyId: invoice.contactId,
        counterpartyTaxId: invoice.customerTaxId,
        counterpartyCountry: countryFrom(invoice.billingAddress),
        documentNumber: invoice.fullNumber,
        correctionOfId,
        rectificationImpact: invoice.rectificationImpact,
      },
    });
    await this.tenant.db.taxLedgerAmount.createMany({
      data: taxLines.map((line) => ({
        ...scope,
        taxLedgerEntryId: entry.id,
        invoiceTaxLineId: line.id,
        taxRuleId: line.taxRuleId,
        taxableBase: line.taxableBase.mul(sign),
        rate: line.taxRate,
        taxAmount: line.taxAmount.mul(sign),
        surchargeRate: line.surchargeRate,
        surchargeAmount: line.surchargeAmount.mul(sign),
      })),
    });
    await this.audit.record("tax_ledger.posted", "tax_ledger", entry.id, {
      invoiceId: invoice.id,
      documentNumber: invoice.fullNumber,
      correctionOfId,
    });
    return this.tenant.db.taxLedgerEntry.findUniqueOrThrow({
      where: { id: entry.id },
      include: { amounts: true },
    });
  }

  private ledgerFilters(query: ListTaxLedgerDto) {
    return {
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.bookType ? { bookType: query.bookType } : {}),
      ...(query.from || query.to
        ? {
            taxPointDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}

function countryFrom(value: Prisma.JsonValue | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const country = value.country;
    if (typeof country === "string" && /^[A-Za-z]{2}$/.test(country))
      return country.toUpperCase();
  }
  return "ES";
}
