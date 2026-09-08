import { Controller, Get, Query, StreamableFile } from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { AccountingReportsService } from "./accounting-reports.service";
import {
  GeneralLedgerReportDto,
  JournalReportDto,
} from "./dto/accounting-report.dto";

@Controller("accounting/reports")
@TenantProtected()
export class AccountingReportsController {
  constructor(private readonly reports: AccountingReportsService) {}

  @Get("journal")
  @RequirePermissions("journal_entry.read")
  journal(@Query() query: JournalReportDto) {
    return this.reports.journal(query);
  }

  @Get("journal.csv")
  @RequirePermissions("journal_entry.read")
  async journalCsv(@Query() query: JournalReportDto) {
    const file = await this.reports.journalCsv(query);
    return new StreamableFile(file.content, {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="${file.filename}"`,
      length: file.content.length,
    });
  }

  @Get("general-ledger")
  @RequirePermissions("journal_entry.read")
  generalLedger(@Query() query: GeneralLedgerReportDto) {
    return this.reports.generalLedger(query);
  }

  @Get("general-ledger.csv")
  @RequirePermissions("journal_entry.read")
  async generalLedgerCsv(@Query() query: GeneralLedgerReportDto) {
    const file = await this.reports.generalLedgerCsv(query);
    return new StreamableFile(file.content, {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="${file.filename}"`,
      length: file.content.length,
    });
  }
}
