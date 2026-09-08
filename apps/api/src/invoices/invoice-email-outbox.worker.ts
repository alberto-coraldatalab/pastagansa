import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  InvoiceEmailStatus,
  InvoiceStatus,
  PrismaClient,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { SmtpInvoiceMailer } from "./smtp-invoice-mailer.service";

interface Candidate {
  organizationId: string;
}

@Injectable()
export class InvoiceEmailOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvoiceEmailOutboxWorker.name);
  private readonly admin: PrismaClient | undefined;
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pdf: InvoicePdfService,
    private readonly mailer: SmtpInvoiceMailer,
  ) {
    const directUrl = config.get<string>("DIRECT_DATABASE_URL");
    if (mailer.enabled && directUrl)
      this.admin = new PrismaClient({
        datasources: { db: { url: directUrl } },
      });
  }

  onModuleInit() {
    if (!this.admin) return;
    this.timer = setInterval(() => void this.tick(), 5_000);
    this.timer.unref();
    void this.tick();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.admin?.$disconnect();
  }

  async processBatch(limit = 20) {
    if (!this.admin || !this.mailer.enabled) return 0;
    await this.admin.$executeRaw`
      UPDATE "invoice_email_deliveries"
      SET "status" = 'FAILED',
          "locked_at" = NULL,
          "last_error" = 'Delivery worker lease expired after maximum attempts',
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "status" = 'PROCESSING'
        AND "attempts" >= 5
        AND "locked_at" < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
    `;
    const candidates = await this.admin.$queryRaw<Candidate[]>`
      SELECT DISTINCT "organization_id" AS "organizationId"
      FROM "invoice_email_deliveries"
      WHERE "attempts" < 5
        AND (("status" = 'PENDING' AND "available_at" <= CURRENT_TIMESTAMP)
          OR ("status" = 'PROCESSING' AND "locked_at" < CURRENT_TIMESTAMP - INTERVAL '15 minutes'))
      LIMIT ${limit}
    `;
    let processed = 0;
    for (const candidate of candidates) {
      const id = await this.claim(candidate.organizationId);
      if (id) {
        await this.deliver(candidate.organizationId, id);
        processed += 1;
      }
    }
    return processed;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.processBatch();
    } catch (error) {
      this.logger.error("Invoice email outbox batch failed", error);
    } finally {
      this.running = false;
    }
  }

  private claim(organizationId: string) {
    return this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
      const [claimed] = await db.$queryRaw<Array<{ id: string }>>`
        UPDATE "invoice_email_deliveries"
        SET "status" = 'PROCESSING',
            "attempts" = "attempts" + 1,
            "locked_at" = CURRENT_TIMESTAMP,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = (
          SELECT "id" FROM "invoice_email_deliveries"
          WHERE "attempts" < 5
            AND (("status" = 'PENDING' AND "available_at" <= CURRENT_TIMESTAMP)
              OR ("status" = 'PROCESSING' AND "locked_at" < CURRENT_TIMESTAMP - INTERVAL '15 minutes'))
          ORDER BY "available_at", "created_at"
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING "id"
      `;
      return claimed?.id ?? null;
    });
  }

  private async deliver(organizationId: string, deliveryId: string) {
    try {
      const delivery = await this.prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
        return db.invoiceEmailDelivery.findUniqueOrThrow({
          where: { id: deliveryId },
          include: {
            invoice: { include: { lines: { orderBy: { position: "asc" } } } },
          },
        });
      });
      const { invoice } = delivery;
      if (!invoice.fullNumber)
        throw new Error("Queued invoice does not have an issued number");
      const content = await this.pdf.render({
        ...invoice,
        fullNumber: invoice.fullNumber,
      });
      await this.mailer.send({
        recipient: delivery.recipient,
        subject: delivery.subject,
        invoiceNumber: invoice.fullNumber,
        issuerLegalName: invoice.issuerLegalName,
        filename: `factura-${safeFilename(invoice.fullNumber)}.pdf`,
        pdf: content,
      });
      await this.prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
        await db.invoiceEmailDelivery.update({
          where: { id: deliveryId },
          data: {
            status: InvoiceEmailStatus.SENT,
            sentAt: new Date(),
            lockedAt: null,
            lastError: null,
          },
        });
        await db.invoice.updateMany({
          where: { id: invoice.id, status: InvoiceStatus.ISSUED },
          data: { status: InvoiceStatus.SENT },
        });
      });
    } catch (error) {
      await this.fail(organizationId, deliveryId, error);
    }
  }

  private async fail(
    organizationId: string,
    deliveryId: string,
    error: unknown,
  ) {
    await this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
      const delivery = await db.invoiceEmailDelivery.findUnique({
        where: { id: deliveryId },
        select: { attempts: true },
      });
      if (!delivery) return;
      const exhausted = delivery.attempts >= 5;
      await db.invoiceEmailDelivery.update({
        where: { id: deliveryId },
        data: {
          status: exhausted
            ? InvoiceEmailStatus.FAILED
            : InvoiceEmailStatus.PENDING,
          availableAt: new Date(Date.now() + retryDelay(delivery.attempts)),
          lockedAt: null,
          lastError: errorMessage(error),
        },
      });
    });
  }
}

function retryDelay(attempts: number) {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

function errorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown delivery error";
  return message.replace(/[\r\n]+/g, " ").slice(0, 1000);
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
