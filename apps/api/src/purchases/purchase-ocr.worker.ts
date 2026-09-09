import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, PrismaClient, PurchaseOcrStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { PurchaseOcrEngine } from "./purchase-ocr-engine.service";
import { extractPurchaseFields } from "./purchase-ocr.parser";

interface Candidate {
  organizationId: string;
}

@Injectable()
export class PurchaseOcrWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PurchaseOcrWorker.name);
  private readonly admin: PrismaClient | undefined;
  private readonly enabled: boolean;
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly engine: PurchaseOcrEngine,
  ) {
    this.enabled = config.get<string>("OCR_WORKER_ENABLED") === "true";
    const directUrl = config.get<string>("DIRECT_DATABASE_URL");
    if (directUrl)
      this.admin = new PrismaClient({
        datasources: { db: { url: directUrl } },
      });
  }

  onModuleInit() {
    if (!this.enabled || !this.admin) return;
    this.timer = setInterval(() => void this.tick(), 5_000);
    this.timer.unref();
    void this.tick();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.admin?.$disconnect();
  }

  async processBatch(limit = 5) {
    if (!this.admin) return 0;
    await this.recoverExpiredLeases();
    const candidates = await this.admin.$queryRaw<Candidate[]>`
      SELECT DISTINCT "organization_id" AS "organizationId"
      FROM "purchase_invoice_ocr_jobs"
      WHERE "attempts" < 3
        AND (("status" = 'PENDING' AND "available_at" <= CURRENT_TIMESTAMP)
          OR ("status" = 'PROCESSING' AND "locked_at" < CURRENT_TIMESTAMP - INTERVAL '15 minutes'))
      LIMIT ${limit}
    `;
    let processed = 0;
    for (const candidate of candidates) {
      const id = await this.claim(candidate.organizationId);
      if (id) {
        await this.extract(candidate.organizationId, id);
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
      this.logger.error("Purchase OCR batch failed", error);
    } finally {
      this.running = false;
    }
  }

  private async recoverExpiredLeases() {
    await this.admin!.$executeRaw`
      UPDATE "purchase_invoice_ocr_jobs"
      SET "status" = 'FAILED', "locked_at" = NULL,
          "last_error" = 'OCR worker lease expired after maximum attempts',
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "status" = 'PROCESSING' AND "attempts" >= 3
        AND "locked_at" < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
    `;
  }

  private claim(organizationId: string) {
    return this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
      const [claimed] = await db.$queryRaw<Array<{ id: string }>>`
        UPDATE "purchase_invoice_ocr_jobs"
        SET "status" = 'PROCESSING', "attempts" = "attempts" + 1,
            "locked_at" = CURRENT_TIMESTAMP, "last_error" = NULL,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = (
          SELECT "id" FROM "purchase_invoice_ocr_jobs"
          WHERE "attempts" < 3
            AND (("status" = 'PENDING' AND "available_at" <= CURRENT_TIMESTAMP)
              OR ("status" = 'PROCESSING' AND "locked_at" < CURRENT_TIMESTAMP - INTERVAL '15 minutes'))
          ORDER BY "available_at", "created_at"
          FOR UPDATE SKIP LOCKED LIMIT 1
        )
        RETURNING "id"
      `;
      return claimed?.id ?? null;
    });
  }

  private async extract(organizationId: string, jobId: string) {
    try {
      const job = await this.prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
        return db.purchaseInvoiceOcrJob.findUniqueOrThrow({
          where: { id: jobId },
          include: { attachment: { select: { content: true } } },
        });
      });
      const result = await this.engine.recognize(
        Buffer.from(job.attachment.content),
      );
      const confidence = clampConfidence(result.confidence);
      const extractedFields = extractPurchaseFields(result.text, confidence);
      await this.prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
        await db.purchaseInvoiceOcrJob.update({
          where: { id: jobId },
          data: {
            status: PurchaseOcrStatus.REVIEW_REQUIRED,
            rawText: result.text.slice(0, 100_000),
            extractedFields:
              extractedFields as unknown as Prisma.InputJsonObject,
            overallConfidence: confidence,
            lockedAt: null,
            lastError: null,
          },
        });
        await db.auditEvent.create({
          data: {
            organizationId,
            companyId: job.companyId,
            actorUserId: null,
            action: "purchase_invoice.ocr_extracted",
            entityType: "purchase_invoice_ocr_job",
            entityId: jobId,
            metadata: {
              purchaseInvoiceId: job.purchaseInvoiceId,
              confidence,
              extractedFields: Object.keys(extractedFields),
            },
          },
        });
      });
    } catch (error) {
      await this.fail(organizationId, jobId, error);
    }
  }

  private async fail(organizationId: string, jobId: string, error: unknown) {
    await this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
      const job = await db.purchaseInvoiceOcrJob.findUnique({
        where: { id: jobId },
        select: {
          attempts: true,
          companyId: true,
          purchaseInvoiceId: true,
        },
      });
      if (!job) return;
      const exhausted = job.attempts >= 3;
      await db.purchaseInvoiceOcrJob.update({
        where: { id: jobId },
        data: {
          status: exhausted
            ? PurchaseOcrStatus.FAILED
            : PurchaseOcrStatus.PENDING,
          availableAt: new Date(Date.now() + retryDelay(job.attempts)),
          lockedAt: null,
          lastError: errorMessage(error),
        },
      });
      await db.auditEvent.create({
        data: {
          organizationId,
          companyId: job.companyId,
          actorUserId: null,
          action: exhausted
            ? "purchase_invoice.ocr_failed"
            : "purchase_invoice.ocr_retry_scheduled",
          entityType: "purchase_invoice_ocr_job",
          entityId: jobId,
          metadata: {
            purchaseInvoiceId: job.purchaseInvoiceId,
            attempts: job.attempts,
          },
        },
      });
    });
  }
}

function retryDelay(attempts: number) {
  return Math.min(30 * 60_000, 15_000 * 2 ** Math.max(0, attempts - 1));
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown OCR error";
  return message.replace(/[\r\n]+/g, " ").slice(0, 1000);
}

function clampConfidence(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}
