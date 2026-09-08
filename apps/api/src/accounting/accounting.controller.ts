import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { AccountingRole, JournalSourceType } from "@prisma/client";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { AccountingService } from "./accounting.service";
import {
  CreateAccountDto,
  CreateFiscalYearDto,
  CreateJournalEntryDto,
  ReverseJournalEntryDto,
} from "./dto/accounting.dto";
import { UpdateAccountingRuleDto } from "./dto/accounting-rule.dto";
import {
  ListJournalEntriesDto,
  TrialBalanceDto,
} from "./dto/list-accounting.dto";

@Controller("accounting")
@TenantProtected()
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get("accounts")
  @RequirePermissions("account.read")
  accounts() {
    return this.accounting.listAccounts();
  }

  @Post("accounts")
  @RequirePermissions("account.manage")
  createAccount(@Body() input: CreateAccountDto) {
    return this.accounting.createAccount(input);
  }

  @Get("rules")
  @RequirePermissions("accounting_rule.read")
  rules() {
    return this.accounting.listRules();
  }

  @Put("rules/:sourceType/:accountingRole")
  @RequirePermissions("accounting_rule.manage")
  updateRule(
    @Param("sourceType", new ParseEnumPipe(JournalSourceType))
    sourceType: JournalSourceType,
    @Param("accountingRole", new ParseEnumPipe(AccountingRole))
    accountingRole: AccountingRole,
    @Body() input: UpdateAccountingRuleDto,
  ) {
    return this.accounting.updateRule(sourceType, accountingRole, input);
  }

  @Get("fiscal-years")
  @RequirePermissions("fiscal_year.read")
  fiscalYears() {
    return this.accounting.listFiscalYears();
  }

  @Post("fiscal-years")
  @RequirePermissions("fiscal_year.manage")
  createFiscalYear(@Body() input: CreateFiscalYearDto) {
    return this.accounting.createFiscalYear(input);
  }

  @Post("periods/:id/lock")
  @HttpCode(200)
  @RequirePermissions("accounting_period.lock")
  lockPeriod(@Param("id", ParseUUIDPipe) id: string) {
    return this.accounting.lockPeriod(id);
  }

  @Get("journal-entries")
  @RequirePermissions("journal_entry.read")
  entries(@Query() query: ListJournalEntriesDto) {
    return this.accounting.listEntries(query);
  }

  @Get("journal-entries/:id")
  @RequirePermissions("journal_entry.read")
  entry(@Param("id", ParseUUIDPipe) id: string) {
    return this.accounting.getEntry(id);
  }

  @Post("journal-entries")
  @RequirePermissions("journal_entry.create")
  createEntry(
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: CreateJournalEntryDto,
  ) {
    return this.accounting.createManualEntry(
      input,
      requireIdempotencyKey(idempotencyKey),
    );
  }

  @Post("journal-entries/:id/reverse")
  @RequirePermissions("journal_entry.reverse")
  reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: ReverseJournalEntryDto,
  ) {
    return this.accounting.reverseEntry(
      id,
      input,
      requireIdempotencyKey(idempotencyKey),
    );
  }

  @Get("trial-balance")
  @RequirePermissions("journal_entry.read")
  trialBalance(@Query() query: TrialBalanceDto) {
    return this.accounting.trialBalance(query);
  }
}

function requireIdempotencyKey(value: string | undefined) {
  const key = value?.trim();
  if (!key || key.length > 128 || /[\u0000-\u001f\u007f]/.test(key))
    throw new BadRequestException(
      "Idempotency-Key must contain between 1 and 128 printable characters",
    );
  return key;
}
