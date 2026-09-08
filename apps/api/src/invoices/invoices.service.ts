import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CatalogItemStatus,
  ContactStatus,
  InvoiceStatus,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { decodeCursor, encodeCursor } from "../common/cursor";
import { TenantContextService } from "../tenancy/tenant-context.service";
import {
  CreateInvoiceDto,
  InvoiceLineDto,
  UpdateInvoiceDto,
} from "./dto/invoice.dto";
import { ListInvoicesDto } from "./dto/list-invoices.dto";
import { IssueInvoiceDto } from "./dto/issue-invoice.dto";
import { InvoicePdfService } from "./invoice-pdf.service";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly pdf: InvoicePdfService,
  ) {}

  async list(query: ListInvoicesDto) {
    const filter = query.status ?? "";
    const cursor = query.cursor
      ? decodeCursor(query.cursor, filter)
      : undefined;
    if (cursor) {
      const exists = await this.tenant.db.invoice.findFirst({
        where: {
          id: cursor.id,
          createdAt: new Date(cursor.sort),
          ...this.scope(),
        },
        select: { id: true },
      });
      if (!exists)
        throw new BadRequestException(
          "Cursor is stale or does not belong to the selected company",
        );
    }
    const invoices = await this.tenant.db.invoice.findMany({
      where: {
        ...this.scope(),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = invoices.length > query.limit;
    const page = hasMore ? invoices.slice(0, -1) : invoices;
    const data = page.map(presentInvoice);
    const last = page.at(-1);
    return {
      data,
      nextCursor:
        hasMore && last
          ? encodeCursor(last.id, last.createdAt.toISOString(), filter)
          : null,
    };
  }

  async get(id: string) {
    const invoice = await this.tenant.db.invoice.findFirst({
      where: { id, ...this.scope() },
      include: { lines: { orderBy: { position: "asc" } } },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return presentInvoice(invoice);
  }

  async downloadPdf(id: string) {
    const invoice = await this.get(id);
    if (invoice.status === InvoiceStatus.DRAFT || !invoice.fullNumber)
      throw new ConflictException("Only issued invoices have an official PDF");
    return {
      filename: `factura-${safeFilename(invoice.fullNumber)}.pdf`,
      content: await this.pdf.render({
        ...invoice,
        fullNumber: invoice.fullNumber,
      }),
    };
  }

  async create(input: CreateInvoiceDto) {
    const scope = this.scope();
    const data = await this.build(input);
    const invoice = await this.tenant.db.invoice.create({
      data: {
        ...scope,
        ...data.document,
        lines: {
          create: data.lines.map((line) => ({ ...line, ...scope })),
        },
      },
      include: { lines: { orderBy: { position: "asc" } } },
    });
    await this.audit.record("invoice.draft_created", "invoice", invoice.id);
    return presentInvoice(invoice);
  }

  async update(id: string, input: UpdateInvoiceDto) {
    const scope = this.scope();
    const data = await this.build(input);
    const changed = await this.tenant.db.invoice.updateMany({
      where: { id, ...scope, status: InvoiceStatus.DRAFT },
      data: data.document,
    });
    if (changed.count !== 1)
      throw new ConflictException(
        "Invoice no longer exists or is no longer a draft",
      );
    await this.tenant.db.invoiceLine.deleteMany({
      where: { invoiceId: id, ...scope },
    });
    await this.tenant.db.invoiceLine.createMany({
      data: data.lines.map((line) => ({ invoiceId: id, ...scope, ...line })),
    });
    await this.audit.record("invoice.draft_updated", "invoice", id);
    return this.get(id);
  }

  async delete(id: string) {
    const changed = await this.tenant.db.invoice.deleteMany({
      where: { id, ...this.scope(), status: InvoiceStatus.DRAFT },
    });
    if (changed.count !== 1)
      throw new ConflictException(
        "Invoice no longer exists or is no longer a draft",
      );
    await this.audit.record("invoice.draft_deleted", "invoice", id);
  }

  async issue(id: string, input: IssueInvoiceDto, idempotencyKey: string) {
    const scope = this.scope();
    const locked = await this.tenant.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "invoices"
      WHERE "id" = CAST(${id} AS uuid)
        AND "organization_id" = CAST(${scope.organizationId} AS uuid)
        AND "company_id" = CAST(${scope.companyId} AS uuid)
      FOR UPDATE
    `;
    if (!locked.length) throw new NotFoundException("Invoice not found");
    const invoice = await this.tenant.db.invoice.findFirstOrThrow({
      where: { id, ...scope },
      include: { lines: { orderBy: { position: "asc" } } },
    });
    if (invoice.status !== InvoiceStatus.DRAFT) {
      if (invoice.issuanceKey === idempotencyKey)
        return presentInvoice(invoice);
      throw new ConflictException("Invoice has already been issued");
    }
    if (!invoice.lines.length)
      throw new BadRequestException("Invoice must contain at least one line");
    const reusedKey = await this.tenant.db.invoice.findFirst({
      where: {
        ...scope,
        issuanceKey: idempotencyKey,
        id: { not: invoice.id },
      },
      select: { id: true },
    });
    if (reusedKey)
      throw new ConflictException(
        "Idempotency-Key has already been used for another invoice",
      );
    const sequence = await this.tenant.db.documentSequence.findFirst({
      where: {
        id: input.sequenceId,
        ...scope,
        documentType: "INVOICE",
        active: true,
      },
    });
    if (!sequence)
      throw new BadRequestException(
        "An active invoice sequence from this company is required",
      );
    const [allocated] = await this.tenant.db.$queryRaw<
      Array<{ number: bigint }>
    >`
      UPDATE "document_sequences"
      SET "next_number" = "next_number" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = CAST(${sequence.id} AS uuid)
        AND "organization_id" = CAST(${scope.organizationId} AS uuid)
        AND "company_id" = CAST(${scope.companyId} AS uuid)
        AND "active" = true
      RETURNING "next_number" - 1 AS "number"
    `;
    if (!allocated)
      throw new ConflictException("Document sequence is no longer active");
    const fullNumber = formatInvoiceNumber(
      sequence.series,
      allocated.number,
      sequence.padding,
    );
    try {
      const changed = await this.tenant.db.invoice.updateMany({
        where: { id, ...scope, status: InvoiceStatus.DRAFT },
        data: {
          sequenceId: sequence.id,
          series: sequence.series,
          number: allocated.number,
          fullNumber,
          issuanceKey: idempotencyKey,
          issuedAt: new Date(),
          status: InvoiceStatus.ISSUED,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Invoice was issued concurrently");
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Invoice number or Idempotency-Key was allocated concurrently",
        );
      throw error;
    }
    await this.audit.record("invoice.issued", "invoice", id, {
      sequenceId: sequence.id,
      series: sequence.series,
      number: allocated.number.toString(),
      fullNumber,
      idempotencyKey,
    });
    return this.get(id);
  }

  private async build(input: CreateInvoiceDto) {
    if (input.dueDate && input.dueDate < input.issueDate)
      throw new BadRequestException("dueDate cannot precede issueDate");
    const scope = this.scope();
    const [company, contact] = await Promise.all([
      this.tenant.db.company.findFirst({
        where: { id: scope.companyId, organizationId: scope.organizationId },
        select: { legalName: true, taxId: true },
      }),
      this.tenant.db.contact.findFirst({
        where: {
          id: input.contactId,
          ...scope,
          isCustomer: true,
          status: ContactStatus.ACTIVE,
        },
        include: {
          addresses: {
            where: { type: "BILLING", archivedAt: null },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            take: 1,
          },
        },
      }),
    ]);
    if (!company) throw new NotFoundException("Company not found");
    if (!contact)
      throw new BadRequestException(
        "Invoice contact must be an active customer in this company",
      );
    const catalogIds = [
      ...new Set(
        input.lines.flatMap(({ catalogItemId }) =>
          catalogItemId ? [catalogItemId] : [],
        ),
      ),
    ];
    if (catalogIds.length) {
      const count = await this.tenant.db.catalogItem.count({
        where: {
          id: { in: catalogIds },
          ...scope,
          status: CatalogItemStatus.ACTIVE,
        },
      });
      if (count !== catalogIds.length)
        throw new BadRequestException(
          "Every catalog item must be active and belong to the selected company",
        );
    }
    const lines = input.lines.map((line, index) =>
      calculateInvoiceLine(line, index + 1),
    );
    const totals = lines.reduce(
      (sum, line) => ({
        subtotal: sum.subtotal.plus(line.gross),
        discountTotal: sum.discountTotal.plus(line.discount),
        taxTotal: sum.taxTotal.plus(line.persisted.taxAmount),
        total: sum.total.plus(line.persisted.totalAmount),
      }),
      zeroTotals(),
    );
    const address = contact.addresses[0];
    return {
      document: {
        contactId: input.contactId,
        issuerLegalName: company.legalName,
        issuerTaxId: company.taxId,
        customerLegalName: contact.legalName,
        customerTaxId: contact.taxId,
        customerEmail: contact.email,
        billingAddress: address
          ? {
              type: address.type,
              label: address.label,
              line1: address.line1,
              line2: address.line2,
              postalCode: address.postalCode,
              city: address.city,
              province: address.province,
              country: address.country,
            }
          : Prisma.JsonNull,
        issueDate: new Date(input.issueDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        currency: input.currency ?? "EUR",
        notes: input.notes?.trim() || null,
        ...totals,
      },
      lines: lines.map(({ persisted }) => persisted),
    };
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}

export function calculateInvoiceLine(input: InvoiceLineDto, position: number) {
  const quantity = new Decimal(input.quantity);
  const unitPrice = new Decimal(input.unitPrice);
  const gross = quantity.mul(unitPrice).toDecimalPlaces(2);
  const discount = gross
    .mul(input.discountPct ?? 0)
    .div(100)
    .toDecimalPlaces(2);
  const netAmount = gross.minus(discount);
  const taxAmount = netAmount
    .mul(input.taxRate ?? 0)
    .div(100)
    .toDecimalPlaces(2);
  return {
    gross,
    discount,
    persisted: {
      position,
      catalogItemId: input.catalogItemId,
      description: input.description.trim(),
      quantity,
      unitPrice,
      discountPct: new Decimal(input.discountPct ?? 0),
      taxRate: new Decimal(input.taxRate ?? 0),
      netAmount,
      taxAmount,
      totalAmount: netAmount.plus(taxAmount),
    },
  };
}

function zeroTotals() {
  return {
    subtotal: new Decimal(0),
    discountTotal: new Decimal(0),
    taxTotal: new Decimal(0),
    total: new Decimal(0),
  };
}

function presentInvoice<T extends { number: bigint | null }>(invoice: T) {
  return { ...invoice, number: invoice.number?.toString() ?? null };
}

export function formatInvoiceNumber(
  series: string,
  number: bigint,
  padding: number,
) {
  return `${series}-${number.toString().padStart(padding, "0")}`;
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
