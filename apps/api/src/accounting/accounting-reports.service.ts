import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { JournalEntryStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { TenantContextService } from "../tenancy/tenant-context.service";
import {
  GeneralLedgerReportDto,
  JournalReportDto,
} from "./dto/accounting-report.dto";

const REPORT_LINE_LIMIT = 100_000;
const DAY_MS = 86_400_000;

@Injectable()
export class AccountingReportsService {
  constructor(private readonly tenant: TenantContextService) {}

  async journal(query: JournalReportDto) {
    const range = validateRange(query.from, query.to);
    const lines = await this.tenant.db.journalLine.findMany({
      where: {
        ...this.scope(),
        entry: {
          status: JournalEntryStatus.POSTED,
          entryDate: { gte: range.from, lte: range.to },
          ...(query.sourceType ? { sourceType: query.sourceType } : {}),
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true } },
        contact: { select: { id: true, legalName: true } },
        entry: true,
      },
      orderBy: [
        { entry: { entryDate: "asc" } },
        { entry: { entryNumber: "asc" } },
        { position: "asc" },
      ],
      take: REPORT_LINE_LIMIT + 1,
    });
    enforceLineLimit(lines.length);
    const totals = lines.reduce(
      (sum, line) => ({
        debit: sum.debit.plus(line.debit),
        credit: sum.credit.plus(line.credit),
      }),
      { debit: new Decimal(0), credit: new Decimal(0) },
    );
    return {
      from: query.from,
      to: query.to,
      sourceType: query.sourceType ?? null,
      totalDebit: totals.debit.toString(),
      totalCredit: totals.credit.toString(),
      lines: lines.map((line) => ({
        id: line.id,
        entryId: line.entry.id,
        entryNumber: line.entry.entryNumber.toString(),
        entryDate: line.entry.entryDate,
        sourceType: line.entry.sourceType,
        sourceId: line.entry.sourceId,
        entryDescription: line.entry.description,
        position: line.position,
        account: line.account,
        contact: line.contact,
        description: line.description,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
      })),
    };
  }

  async journalCsv(query: JournalReportDto) {
    const report = await this.journal(query);
    const rows: CsvValue[][] = [
      [
        text("entry_number"),
        text("entry_date"),
        text("source_type"),
        text("source_id"),
        text("entry_description"),
        text("line_position"),
        text("account_code"),
        text("account_name"),
        text("contact_name"),
        text("line_description"),
        text("debit"),
        text("credit"),
      ],
      ...report.lines.map((line) => [
        number(line.entryNumber),
        text(isoDate(line.entryDate)),
        text(line.sourceType),
        text(line.sourceId),
        text(line.entryDescription),
        number(line.position),
        text(line.account.code),
        text(line.account.name),
        text(line.contact?.legalName),
        text(line.description),
        number(line.debit),
        number(line.credit),
      ]),
    ];
    return csvFile(
      `journal-${query.from}-${query.to}.csv`,
      renderCsv(rows),
    );
  }

  async generalLedger(query: GeneralLedgerReportDto) {
    const range = validateRange(query.from, query.to);
    const scope = this.scope();
    const account = await this.tenant.db.account.findFirst({
      where: { id: query.accountId, ...scope },
      select: { id: true, code: true, name: true, accountClass: true },
    });
    if (!account) throw new NotFoundException("Accounting account not found");
    const baseWhere: Prisma.JournalLineWhereInput = {
      ...scope,
      accountId: account.id,
      entry: { status: JournalEntryStatus.POSTED },
    };
    const [opening, lines] = await Promise.all([
      this.tenant.db.journalLine.aggregate({
        where: {
          ...baseWhere,
          entry: {
            status: JournalEntryStatus.POSTED,
            entryDate: { lt: range.from },
          },
        },
        _sum: { debit: true, credit: true },
      }),
      this.tenant.db.journalLine.findMany({
        where: {
          ...baseWhere,
          entry: {
            status: JournalEntryStatus.POSTED,
            entryDate: { gte: range.from, lte: range.to },
          },
        },
        include: {
          contact: { select: { id: true, legalName: true } },
          entry: true,
        },
        orderBy: [
          { entry: { entryDate: "asc" } },
          { entry: { entryNumber: "asc" } },
          { position: "asc" },
        ],
        take: REPORT_LINE_LIMIT + 1,
      }),
    ]);
    enforceLineLimit(lines.length);
    const openingBalance = (opening._sum.debit ?? new Decimal(0)).minus(
      opening._sum.credit ?? new Decimal(0),
    );
    let runningBalance = openingBalance;
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const presented = lines.map((line) => {
      totalDebit = totalDebit.plus(line.debit);
      totalCredit = totalCredit.plus(line.credit);
      runningBalance = runningBalance.plus(line.debit).minus(line.credit);
      return {
        id: line.id,
        entryId: line.entry.id,
        entryNumber: line.entry.entryNumber.toString(),
        entryDate: line.entry.entryDate,
        description: line.description ?? line.entry.description,
        contact: line.contact,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
        runningBalance: runningBalance.toString(),
      };
    });
    return {
      account,
      from: query.from,
      to: query.to,
      openingBalance: openingBalance.toString(),
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      closingBalance: runningBalance.toString(),
      lines: presented,
    };
  }

  async generalLedgerCsv(query: GeneralLedgerReportDto) {
    const report = await this.generalLedger(query);
    const rows: CsvValue[][] = [
      [
        text("record_type"),
        text("entry_number"),
        text("entry_date"),
        text("description"),
        text("contact_name"),
        text("debit"),
        text("credit"),
        text("balance"),
      ],
      [
        text("OPENING"),
        text(null),
        text(query.from),
        text(`Opening balance ${report.account.code}`),
        text(null),
        number(null),
        number(null),
        number(report.openingBalance),
      ],
      ...report.lines.map((line) => [
        text("ENTRY"),
        number(line.entryNumber),
        text(isoDate(line.entryDate)),
        text(line.description),
        text(line.contact?.legalName),
        number(line.debit),
        number(line.credit),
        number(line.runningBalance),
      ]),
      [
        text("TOTAL"),
        text(null),
        text(query.to),
        text(`Closing balance ${report.account.code}`),
        text(null),
        number(report.totalDebit),
        number(report.totalCredit),
        number(report.closingBalance),
      ],
    ];
    return csvFile(
      `general-ledger-${report.account.code}-${query.from}-${query.to}.csv`,
      renderCsv(rows),
    );
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}

interface CsvValue {
  value: string;
  textual: boolean;
}

function validateRange(from: string, to: string) {
  if (from > to) throw new BadRequestException("from cannot be after to");
  const start = new Date(from);
  const end = new Date(to);
  if ((end.getTime() - start.getTime()) / DAY_MS > 366)
    throw new BadRequestException("Accounting report range cannot exceed 366 days");
  return { from: start, to: end };
}

function enforceLineLimit(count: number) {
  if (count > REPORT_LINE_LIMIT)
    throw new PayloadTooLargeException(
      `Accounting report exceeds ${REPORT_LINE_LIMIT} lines`,
    );
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function text(value: string | number | null | undefined): CsvValue {
  return { value: value == null ? "" : String(value), textual: true };
}

function number(value: string | number | null | undefined): CsvValue {
  return { value: value == null ? "" : String(value), textual: false };
}

function renderCsv(rows: CsvValue[][]) {
  return `\uFEFF${rows
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n")}\r\n`;
}

function csvCell(cell: CsvValue) {
  const value =
    cell.textual && /^[=+\-@]/.test(cell.value) ? `'${cell.value}` : cell.value;
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvFile(filename: string, content: string) {
  return { filename, content: Buffer.from(content, "utf8") };
}
