import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountClass,
  AccountingRole,
  AccountingPeriodStatus,
  FiscalYearStatus,
  InvoiceStatus,
  JournalEntryStatus,
  JournalSourceType,
  Prisma,
  PurchaseInvoiceStatus,
  RectificationImpact,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { decodeCursor, encodeCursor } from "../common/cursor";
import { TenantContextService } from "../tenancy/tenant-context.service";
import {
  CreateAccountDto,
  CreateFiscalYearDto,
  CreateJournalEntryDto,
  ReverseJournalEntryDto,
} from "./dto/accounting.dto";
import {
  ListJournalEntriesDto,
  TrialBalanceDto,
} from "./dto/list-accounting.dto";

interface PostingLine {
  accountId: string;
  contactId?: string;
  description?: string;
  debit: Decimal;
  credit: Decimal;
}

@Injectable()
export class AccountingService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async listAccounts() {
    await this.ensureAccounts();
    return this.tenant.db.account.findMany({
      where: this.scope(),
      orderBy: { code: "asc" },
    });
  }

  async createAccount(input: CreateAccountDto) {
    const scope = this.scope();
    if (input.parentId) {
      const parent = await this.tenant.db.account.findFirst({
        where: { id: input.parentId, ...scope },
      });
      if (!parent) throw new BadRequestException("Parent account not found");
    }
    try {
      const account = await this.tenant.db.account.create({
        data: {
          ...scope,
          code: input.code.trim(),
          name: input.name.trim(),
          accountClass: input.accountClass,
          systemRole: input.systemRole,
          parentId: input.parentId,
          isReconcilable: input.isReconcilable,
        },
      });
      await this.audit.record("account.created", "account", account.id);
      return account;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Account code or system role already exists",
        );
      throw error;
    }
  }

  async listFiscalYears() {
    const years = await this.tenant.db.fiscalYear.findMany({
      where: this.scope(),
      include: { periods: { orderBy: { startDate: "asc" } } },
      orderBy: { startDate: "desc" },
    });
    return years.map(presentFiscalYear);
  }

  async createFiscalYear(input: CreateFiscalYearDto) {
    if (input.startDate > input.endDate)
      throw new BadRequestException("startDate cannot follow endDate");
    const scope = this.scope();
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const overlap = await this.tenant.db.fiscalYear.findFirst({
      where: {
        ...scope,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlap)
      throw new ConflictException("Fiscal year overlaps an existing year");
    try {
      const year = await this.tenant.db.fiscalYear.create({
        data: {
          ...scope,
          code: input.code.trim(),
          startDate,
          endDate,
        },
      });
      if (input.createMonthlyPeriods)
        await this.createPeriods(year.id, startDate, endDate);
      await this.audit.record("fiscal_year.created", "fiscal_year", year.id);
      const created = await this.tenant.db.fiscalYear.findUniqueOrThrow({
        where: { id: year.id },
        include: { periods: { orderBy: { startDate: "asc" } } },
      });
      return presentFiscalYear(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Fiscal year code already exists");
      throw error;
    }
  }

  async lockPeriod(id: string) {
    const scope = this.scope();
    const changed = await this.tenant.db.accountingPeriod.updateMany({
      where: { id, ...scope, status: AccountingPeriodStatus.OPEN },
      data: {
        status: AccountingPeriodStatus.LOCKED,
        lockedAt: new Date(),
        lockedById: this.tenant.required.userId,
      },
    });
    if (changed.count !== 1)
      throw new ConflictException(
        "Accounting period was not found or is locked",
      );
    await this.audit.record(
      "accounting_period.locked",
      "accounting_period",
      id,
    );
    return this.tenant.db.accountingPeriod.findUniqueOrThrow({ where: { id } });
  }

  async listEntries(query: ListJournalEntriesDto) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException("from cannot be after to");
    const filter = `${query.sourceType ?? ""}:${query.from ?? ""}:${query.to ?? ""}`;
    const cursor = query.cursor
      ? decodeCursor(query.cursor, filter)
      : undefined;
    const where: Prisma.JournalEntryWhereInput = {
      ...this.scope(),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.from || query.to
        ? {
            entryDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    if (cursor) {
      const exists = await this.tenant.db.journalEntry.findFirst({
        where: { id: cursor.id, entryDate: new Date(cursor.sort), ...where },
      });
      if (!exists)
        throw new BadRequestException(
          "Cursor is stale or does not belong to the selected company",
        );
    }
    const entries = await this.tenant.db.journalEntry.findMany({
      where,
      include: {
        lines: { include: { account: true }, orderBy: { position: "asc" } },
      },
      orderBy: [{ entryDate: "desc" }, { entryNumber: "desc" }],
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = entries.length > query.limit;
    const page = hasMore ? entries.slice(0, -1) : entries;
    const last = page.at(-1);
    return {
      data: page.map(presentEntry),
      nextCursor:
        hasMore && last
          ? encodeCursor(last.id, last.entryDate.toISOString(), filter)
          : null,
    };
  }

  async getEntry(id: string) {
    const entry = await this.tenant.db.journalEntry.findFirst({
      where: { id, ...this.scope() },
      include: {
        lines: { include: { account: true }, orderBy: { position: "asc" } },
        reversalOf: { select: { id: true, entryNumber: true } },
        reversedBy: { select: { id: true, entryNumber: true } },
      },
    });
    if (!entry) throw new NotFoundException("Journal entry not found");
    return {
      ...presentEntry(entry),
      reversalOf: entry.reversalOf
        ? {
            ...entry.reversalOf,
            entryNumber: entry.reversalOf.entryNumber.toString(),
          }
        : null,
      reversedBy: entry.reversedBy
        ? {
            ...entry.reversedBy,
            entryNumber: entry.reversedBy.entryNumber.toString(),
          }
        : null,
    };
  }

  async createManualEntry(
    input: CreateJournalEntryDto,
    idempotencyKey: string,
  ) {
    await this.lockIdempotencyKey(idempotencyKey);
    const existing = await this.tenant.db.journalEntry.findFirst({
      where: { ...this.scope(), idempotencyKey },
    });
    if (existing) return this.getEntry(existing.id);
    const accountIds = [
      ...new Set(input.lines.map(({ accountId }) => accountId)),
    ];
    const activeAccounts = await this.tenant.db.account.count({
      where: { ...this.scope(), id: { in: accountIds }, active: true },
    });
    if (activeAccounts !== accountIds.length)
      throw new BadRequestException(
        "Every journal line must use an active company account",
      );
    const lines = input.lines.map((line) => {
      const debit = new Decimal(line.debit);
      const credit = new Decimal(line.credit);
      if (
        (debit.greaterThan(0) ? 1 : 0) + (credit.greaterThan(0) ? 1 : 0) !==
        1
      )
        throw new BadRequestException(
          "Every journal line must contain either debit or credit",
        );
      return {
        accountId: line.accountId,
        contactId: line.contactId,
        description: line.description?.trim(),
        debit,
        credit,
      };
    });
    const totals = lines.reduce(
      (sum, line) => ({
        debit: sum.debit.plus(line.debit),
        credit: sum.credit.plus(line.credit),
      }),
      { debit: new Decimal(0), credit: new Decimal(0) },
    );
    if (!totals.debit.equals(totals.credit) || !totals.debit.greaterThan(0))
      throw new BadRequestException(
        "Journal entry debits and credits must balance above zero",
      );
    return this.createPostedEntry({
      entryDate: new Date(input.entryDate),
      description: input.description.trim(),
      sourceType: JournalSourceType.MANUAL,
      idempotencyKey,
      lines,
    });
  }

  async reverseEntry(
    id: string,
    input: ReverseJournalEntryDto,
    idempotencyKey: string,
  ) {
    await this.lockIdempotencyKey(idempotencyKey);
    const retried = await this.tenant.db.journalEntry.findFirst({
      where: { ...this.scope(), idempotencyKey },
    });
    if (retried) return this.getEntry(retried.id);
    const locked = await this.tenant.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "journal_entries"
      WHERE "id" = CAST(${id} AS uuid)
        AND "organization_id" = CAST(${this.scope().organizationId} AS uuid)
        AND "company_id" = CAST(${this.scope().companyId} AS uuid)
      FOR UPDATE
    `;
    if (!locked.length) throw new NotFoundException("Journal entry not found");
    const original = await this.tenant.db.journalEntry.findFirst({
      where: { id, ...this.scope(), status: JournalEntryStatus.POSTED },
      include: { lines: { orderBy: { position: "asc" } }, reversedBy: true },
    });
    if (!original)
      throw new ConflictException("Only posted entries can be reversed");
    if (original.reversedBy)
      throw new ConflictException("Journal entry has already been reversed");
    if (input.entryDate < original.entryDate.toISOString().slice(0, 10))
      throw new BadRequestException(
        "Reversal date cannot precede original entry date",
      );
    return this.createPostedEntry({
      entryDate: new Date(input.entryDate),
      description: `Reversal: ${input.reason.trim()}`,
      sourceType: JournalSourceType.MANUAL,
      idempotencyKey,
      reversalOfId: original.id,
      lines: original.lines.map((line) => ({
        accountId: line.accountId,
        contactId: line.contactId ?? undefined,
        description: line.description ?? undefined,
        debit: line.credit,
        credit: line.debit,
      })),
    });
  }

  async trialBalance(query: TrialBalanceDto) {
    if (query.from > query.to)
      throw new BadRequestException("from cannot be after to");
    const scope = this.scope();
    const rows = await this.tenant.db.$queryRaw<
      Array<{
        accountId: string;
        code: string;
        name: string;
        debit: Decimal;
        credit: Decimal;
        balance: Decimal;
      }>
    >`
      SELECT a."id" AS "accountId", a."code", a."name",
        SUM(l."debit") AS "debit", SUM(l."credit") AS "credit",
        SUM(l."debit" - l."credit") AS "balance"
      FROM "journal_lines" l
      JOIN "journal_entries" e ON e."id" = l."journal_entry_id"
      JOIN "accounts" a ON a."id" = l."account_id"
      WHERE l."organization_id" = CAST(${scope.organizationId} AS uuid)
        AND l."company_id" = CAST(${scope.companyId} AS uuid)
        AND e."status" = 'POSTED'
        AND e."entry_date" BETWEEN CAST(${query.from} AS date) AND CAST(${query.to} AS date)
      GROUP BY a."id", a."code", a."name"
      ORDER BY a."code"
    `;
    return rows.map((row) => ({
      ...row,
      debit: row.debit.toString(),
      credit: row.credit.toString(),
      balance: row.balance.toString(),
    }));
  }

  async postSalesInvoice(invoiceId: string) {
    const existing = await this.tenant.db.journalEntry.findFirst({
      where: {
        ...this.scope(),
        sourceType: JournalSourceType.SALES_INVOICE,
        sourceId: invoiceId,
      },
    });
    if (existing) return this.getEntry(existing.id);
    const invoice = await this.tenant.db.invoice.findFirst({
      where: {
        id: invoiceId,
        ...this.scope(),
        status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
      },
    });
    if (!invoice || !invoice.fullNumber)
      throw new ConflictException("Only issued invoices can be posted");
    const accounts = await this.accountsByRole();
    const net = invoice.total.minus(invoice.taxTotal);
    const decrease =
      invoice.rectificationImpact === RectificationImpact.DECREASE;
    const lines: PostingLine[] = decrease
      ? [
          posting(accounts.SALES_REVENUE, net, false, invoice.contactId),
          ...(invoice.taxTotal.greaterThan(0)
            ? [posting(accounts.OUTPUT_VAT, invoice.taxTotal, false)]
            : []),
          posting(
            accounts.CUSTOMER_RECEIVABLE,
            invoice.total,
            true,
            invoice.contactId,
          ),
        ]
      : [
          posting(
            accounts.CUSTOMER_RECEIVABLE,
            invoice.total,
            false,
            invoice.contactId,
          ),
          posting(accounts.SALES_REVENUE, net, true),
          ...(invoice.taxTotal.greaterThan(0)
            ? [posting(accounts.OUTPUT_VAT, invoice.taxTotal, true)]
            : []),
        ];
    return this.createPostedEntry({
      entryDate: invoice.issueDate,
      description: `Sales invoice ${invoice.fullNumber}`,
      sourceType: JournalSourceType.SALES_INVOICE,
      sourceId: invoice.id,
      lines,
    });
  }

  async postPurchaseInvoice(purchaseInvoiceId: string) {
    const existing = await this.tenant.db.journalEntry.findFirst({
      where: {
        ...this.scope(),
        sourceType: JournalSourceType.PURCHASE_INVOICE,
        sourceId: purchaseInvoiceId,
      },
    });
    if (existing) return this.getEntry(existing.id);
    const purchase = await this.tenant.db.purchaseInvoice.findFirst({
      where: {
        id: purchaseInvoiceId,
        ...this.scope(),
        status: PurchaseInvoiceStatus.APPROVED,
      },
    });
    if (!purchase)
      throw new ConflictException(
        "Only approved purchase invoices can be posted",
      );
    const accounts = await this.accountsByRole();
    const expense = purchase.total.minus(purchase.deductibleTaxTotal);
    return this.createPostedEntry({
      entryDate: purchase.operationDate,
      description: `Purchase invoice ${purchase.supplierInvoiceNumber}`,
      sourceType: JournalSourceType.PURCHASE_INVOICE,
      sourceId: purchase.id,
      lines: [
        posting(accounts.PURCHASE_EXPENSE, expense, false, purchase.supplierId),
        ...(purchase.deductibleTaxTotal.greaterThan(0)
          ? [posting(accounts.INPUT_VAT, purchase.deductibleTaxTotal, false)]
          : []),
        posting(
          accounts.SUPPLIER_PAYABLE,
          purchase.total,
          true,
          purchase.supplierId,
        ),
      ],
    });
  }

  private async createPostedEntry(input: {
    entryDate: Date;
    description: string;
    sourceType: JournalSourceType;
    sourceId?: string;
    idempotencyKey?: string;
    reversalOfId?: string;
    lines: PostingLine[];
  }) {
    const scope = this.scope();
    const year = await this.ensureFiscalYear(input.entryDate);
    await this.tenant.db.$queryRaw`
      SELECT "id" FROM "fiscal_years"
      WHERE "id" = CAST(${year.id} AS uuid) FOR UPDATE
    `;
    const current = await this.tenant.db.fiscalYear.findFirst({
      where: { id: year.id, ...scope, status: FiscalYearStatus.OPEN },
    });
    if (!current)
      throw new ConflictException("The fiscal year is not open for posting");
    const lockedPeriod = await this.tenant.db.accountingPeriod.findFirst({
      where: {
        ...scope,
        fiscalYearId: current.id,
        startDate: { lte: input.entryDate },
        endDate: { gte: input.entryDate },
        status: AccountingPeriodStatus.LOCKED,
      },
      select: { id: true },
    });
    if (lockedPeriod)
      throw new ConflictException("The accounting period is locked");
    const entry = await this.tenant.db.journalEntry.create({
      data: {
        ...scope,
        fiscalYearId: current.id,
        entryNumber: current.nextEntryNumber,
        entryDate: input.entryDate,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        reversalOfId: input.reversalOfId,
        createdById: this.tenant.required.userId,
      },
    });
    await this.tenant.db.journalLine.createMany({
      data: input.lines.map((line, index) => ({
        ...scope,
        journalEntryId: entry.id,
        accountId: line.accountId,
        contactId: line.contactId,
        position: index + 1,
        description: line.description,
        debit: line.debit,
        credit: line.credit,
      })),
    });
    await this.tenant.db.journalEntry.update({
      where: { id: entry.id },
      data: { status: JournalEntryStatus.POSTED, postedAt: new Date() },
    });
    await this.tenant.db.fiscalYear.update({
      where: { id: current.id },
      data: { nextEntryNumber: { increment: 1 } },
    });
    await this.audit.record(
      "accounting.entry.posted",
      "journal_entry",
      entry.id,
      {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        entryNumber: current.nextEntryNumber.toString(),
        reversalOfId: input.reversalOfId,
      },
    );
    return this.getEntry(entry.id);
  }

  private async accountsByRole() {
    await this.ensureAccounts();
    const accounts = await this.tenant.db.account.findMany({
      where: { ...this.scope(), active: true, systemRole: { not: null } },
    });
    const byRole = new Map(
      accounts.map((account) => [account.systemRole, account.id]),
    );
    const required = [
      AccountingRole.CUSTOMER_RECEIVABLE,
      AccountingRole.SUPPLIER_PAYABLE,
      AccountingRole.SALES_REVENUE,
      AccountingRole.PURCHASE_EXPENSE,
      AccountingRole.OUTPUT_VAT,
      AccountingRole.INPUT_VAT,
    ];
    for (const role of required)
      if (!byRole.has(role))
        throw new ConflictException(
          `Active accounting role ${role} is required`,
        );
    return Object.fromEntries(
      required.map((role) => [role, byRole.get(role)!]),
    ) as Record<(typeof required)[number], string>;
  }

  private async ensureAccounts() {
    const scope = this.scope();
    await this.tenant.db.account.createMany({
      data: DEFAULT_ACCOUNTS.map((account) => ({ ...scope, ...account })),
      skipDuplicates: true,
    });
  }

  private async ensureFiscalYear(date: Date) {
    const scope = this.scope();
    const existing = await this.tenant.db.fiscalYear.findFirst({
      where: { ...scope, startDate: { lte: date }, endDate: { gte: date } },
    });
    if (existing) return existing;
    const yearNumber = date.getUTCFullYear();
    const startDate = new Date(`${yearNumber}-01-01`);
    const endDate = new Date(`${yearNumber}-12-31`);
    const year = await this.tenant.db.fiscalYear.upsert({
      where: {
        companyId_code: {
          companyId: scope.companyId,
          code: String(yearNumber),
        },
      },
      update: {},
      create: { ...scope, code: String(yearNumber), startDate, endDate },
    });
    await this.createPeriods(year.id, startDate, endDate);
    return year;
  }

  private async createPeriods(
    fiscalYearId: string,
    startDate: Date,
    endDate: Date,
  ) {
    await this.tenant.db.accountingPeriod.createMany({
      data: monthlyPeriods(startDate, endDate).map((period) => ({
        ...this.scope(),
        fiscalYearId,
        ...period,
      })),
      skipDuplicates: true,
    });
  }

  private async lockIdempotencyKey(key: string) {
    const { companyId } = this.scope();
    await this.tenant.db.$queryRaw<Array<{ locked: boolean}>>`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${companyId}:${key}`}, 0)
      ) IS NULL AS "locked"
    `;
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}

const DEFAULT_ACCOUNTS = [
  {
    code: "430000",
    name: "Clientes",
    accountClass: AccountClass.ASSET,
    systemRole: AccountingRole.CUSTOMER_RECEIVABLE,
    isReconcilable: true,
  },
  {
    code: "400000",
    name: "Proveedores",
    accountClass: AccountClass.LIABILITY,
    systemRole: AccountingRole.SUPPLIER_PAYABLE,
    isReconcilable: true,
  },
  {
    code: "700000",
    name: "Ventas",
    accountClass: AccountClass.INCOME,
    systemRole: AccountingRole.SALES_REVENUE,
    isReconcilable: false,
  },
  {
    code: "600000",
    name: "Compras",
    accountClass: AccountClass.EXPENSE,
    systemRole: AccountingRole.PURCHASE_EXPENSE,
    isReconcilable: false,
  },
  {
    code: "477000",
    name: "Hacienda Pública, IVA repercutido",
    accountClass: AccountClass.LIABILITY,
    systemRole: AccountingRole.OUTPUT_VAT,
    isReconcilable: false,
  },
  {
    code: "472000",
    name: "Hacienda Pública, IVA soportado",
    accountClass: AccountClass.ASSET,
    systemRole: AccountingRole.INPUT_VAT,
    isReconcilable: false,
  },
  {
    code: "572000",
    name: "Bancos",
    accountClass: AccountClass.ASSET,
    systemRole: AccountingRole.BANK,
    isReconcilable: true,
  },
] as const;

function posting(
  accountId: string,
  amount: Decimal,
  credit: boolean,
  contactId?: string,
): PostingLine {
  return {
    accountId,
    contactId,
    debit: credit ? new Decimal(0) : amount,
    credit: credit ? amount : new Decimal(0),
  };
}

function monthlyPeriods(startDate: Date, endDate: Date) {
  const periods: Array<{ code: string; startDate: Date; endDate: Date }> = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const monthStart = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    );
    const periodStart = monthStart < startDate ? startDate : monthStart;
    const periodEnd = monthEnd > endDate ? endDate : monthEnd;
    periods.push({
      code: `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, "0")}`,
      startDate: periodStart,
      endDate: periodEnd,
    });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }
  return periods;
}

function presentEntry<T extends { entryNumber: bigint }>(entry: T) {
  return { ...entry, entryNumber: entry.entryNumber.toString() };
}

function presentFiscalYear<T extends { nextEntryNumber: bigint }>(year: T) {
  return { ...year, nextEntryNumber: year.nextEntryNumber.toString() };
}
