import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/permissions.decorator";
import { TenantProtected } from "../tenancy/tenant.decorator";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { SetPaymentScheduleDto } from "./dto/set-payment-schedule.dto";
import { PaymentsService } from "./payments.service";

@Controller("invoices/:invoiceId")
@TenantProtected()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("payment-schedule")
  @RequirePermissions("payment.read")
  schedule(@Param("invoiceId", ParseUUIDPipe) invoiceId: string) {
    return this.payments.getSchedule(invoiceId);
  }

  @Put("payment-schedule")
  @RequirePermissions("invoice.update")
  setSchedule(
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() input: SetPaymentScheduleDto,
  ) {
    return this.payments.setSchedule(invoiceId, input);
  }

  @Get("payments")
  @RequirePermissions("payment.read")
  list(@Param("invoiceId", ParseUUIDPipe) invoiceId: string) {
    return this.payments.list(invoiceId);
  }

  @Post("payments")
  @RequirePermissions("payment.create")
  record(
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: RecordPaymentDto,
  ) {
    return this.payments.record(
      invoiceId,
      input,
      requireIdempotencyKey(idempotencyKey),
    );
  }
}

function requireIdempotencyKey(value: string | undefined) {
  if (!value || value.trim() !== value || !value.length || value.length > 128)
    throw new BadRequestException(
      "Idempotency-Key must contain 1 to 128 non-whitespace-padded characters",
    );
  if (/[^\x20-\x7E]/.test(value))
    throw new BadRequestException(
      "Idempotency-Key must contain printable ASCII",
    );
  return value;
}
