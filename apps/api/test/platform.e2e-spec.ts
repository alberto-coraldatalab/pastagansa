import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request = require("supertest");
import type { Test as SupertestTest } from "supertest";
import { AppModule } from "../src/app.module";

describe("platform integrity", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const admin = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_DATABASE_URL } },
  });

  beforeAll(async () => {
    await admin.$executeRawUnsafe(
      "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pastagansa_app') THEN CREATE ROLE pastagansa_app LOGIN PASSWORD 'pastagansa_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF; END $$",
    );
    await admin.$executeRawUnsafe(
      "GRANT USAGE ON SCHEMA public TO pastagansa_app",
    );
    await admin.$executeRawUnsafe(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pastagansa_app",
    );
    await admin.$executeRawUnsafe(
      "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pastagansa_app",
    );
    await admin.$executeRawUnsafe(
      'TRUNCATE TABLE "organizations", "users", "roles", "permissions" CASCADE',
    );
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("v1");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    await prisma.$disconnect();
    await admin.$disconnect();
  });

  it("enforces tenant boundaries, quote integrity, refresh CAS, and revocation", async () => {
    const accountA = await register(
      "owner-a@example.com",
      "Org A",
      "A Company",
      "B12345674",
    );
    const accountB = await register(
      "owner-b@example.com",
      "Org B",
      "B Company",
      "A58818501",
    );
    const tenantA = await tenantFor("owner-a@example.com");
    const tenantB = await tenantFor("owner-b@example.com");

    const taxRules = await authed(accountA.accessToken, tenantA)
      .get("/v1/tax-rules?effectiveOn=2026-09-08")
      .expect(200);
    expect(taxRules.body).toHaveLength(6);
    expect(taxRules.body.map(({ code }: { code: string }) => code)).toContain(
      "ES_VAT_GENERAL_21",
    );

    const contactA = await authed(accountA.accessToken, tenantA)
      .post("/v1/contacts")
      .send({
        legalName: "Customer A",
        email: "billing-a@example.com",
        isCustomer: true,
        isSupplier: false,
        paymentTermsDays: 30,
        paymentMethod: "BANK_TRANSFER",
      })
      .expect(201);
    expect(contactA.body.paymentTermsDays).toBe(30);
    const contactB = await authed(accountB.accessToken, tenantB)
      .post("/v1/contacts")
      .send({ legalName: "Customer B", isCustomer: true, isSupplier: false })
      .expect(201);
    const itemB = await authed(accountB.accessToken, tenantB)
      .post("/v1/catalog-items")
      .send({
        type: "SERVICE",
        sku: "B-SVC",
        name: "B service",
        salesPrice: 10,
        currency: "EUR",
      })
      .expect(201);

    await authed(accountA.accessToken, tenantB).get("/v1/contacts").expect(403);
    await authed(accountA.accessToken, tenantA)
      .post("/v1/quotes")
      .send(quote(contactA.body.id, itemB.body.id))
      .expect(400);
    const createdQuote = await authed(accountA.accessToken, tenantA)
      .post("/v1/quotes")
      .send(quote(contactA.body.id))
      .expect(201);
    expect(createdQuote.body.customerLegalName).toBe("Customer A");
    expect(createdQuote.body.lines[0].totalAmount).toBe("121");
    const quotePdf = await authed(accountA.accessToken, tenantA)
      .get(`/v1/quotes/${createdQuote.body.id}/pdf`)
      .expect("content-type", /application\/pdf/)
      .expect(
        "content-disposition",
        /attachment; filename="presupuesto-.+\.pdf"/,
      )
      .expect(200);
    expect(Buffer.isBuffer(quotePdf.body)).toBe(true);
    expect(quotePdf.body.subarray(0, 5).toString()).toBe("%PDF-");

    const sequence = await authed(accountA.accessToken, tenantA)
      .post("/v1/document-sequences")
      .send({ documentType: "INVOICE", series: "F2026", padding: 5 })
      .expect(201);
    expect(sequence.body.nextNumber).toBe("1");
    await authed(accountA.accessToken, tenantA)
      .post("/v1/document-sequences")
      .send({ documentType: "INVOICE", series: "F2026" })
      .expect(409);
    const creditSequence = await authed(accountA.accessToken, tenantA)
      .post("/v1/document-sequences")
      .send({ documentType: "CREDIT_NOTE", series: "R2026", padding: 5 })
      .expect(201);

    const invoiceDraft = await authed(accountA.accessToken, tenantA)
      .post("/v1/invoices")
      .send(invoice(contactA.body.id))
      .expect(201);
    expect(invoiceDraft.body.status).toBe("DRAFT");
    expect(invoiceDraft.body.number).toBeNull();
    expect(invoiceDraft.body.customerEmail).toBe("billing-a@example.com");
    expect(invoiceDraft.body.total).toBe("121");
    expect(invoiceDraft.body.lines[0].taxLines[0]).toMatchObject({
      taxCode: "ES_VAT_GENERAL_21",
      taxableBase: "100",
      taxRate: "21",
      taxAmount: "21",
      subject: true,
      exempt: false,
    });
    await authed(accountA.accessToken, tenantA)
      .post("/v1/invoices")
      .send({
        ...invoice(contactA.body.id),
        lines: [
          {
            description: "Ambiguous zero-rate operation",
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
          },
        ],
      })
      .expect(400);
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/invoices/${invoiceDraft.body.id}`)
      .expect(404);
    const updatedInvoice = await authed(accountA.accessToken, tenantA)
      .patch(`/v1/invoices/${invoiceDraft.body.id}`)
      .send({ ...invoice(contactA.body.id), notes: "Updated draft" })
      .expect(200);
    expect(updatedInvoice.body.notes).toBe("Updated draft");
    await authed(accountA.accessToken, tenantA)
      .put(`/v1/invoices/${invoiceDraft.body.id}/payment-schedule`)
      .send({
        installments: [
          { dueDate: "2026-09-30", amount: 60 },
          { dueDate: "2026-10-31", amount: 60 },
        ],
      })
      .expect(400);
    const paymentSchedule = await authed(accountA.accessToken, tenantA)
      .put(`/v1/invoices/${invoiceDraft.body.id}/payment-schedule`)
      .send({
        installments: [
          { dueDate: "2026-09-30", amount: 60.5 },
          { dueDate: "2026-10-31", amount: 60.5 },
        ],
      })
      .expect(200);
    expect(paymentSchedule.body).toHaveLength(2);
    expect(paymentSchedule.body[1]).toMatchObject({
      position: 2,
      amount: "60.5",
      paidAmount: "0",
      status: "PENDING",
    });
    await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}/pdf`)
      .expect(409);
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/issue`)
      .send({ sequenceId: sequence.body.id })
      .expect(400);
    const issuedInvoice = await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/issue`)
      .set("idempotency-key", "issue-invoice-a")
      .send({ sequenceId: sequence.body.id })
      .expect(200);
    expect(issuedInvoice.body.status).toBe("ISSUED");
    expect(issuedInvoice.body.fullNumber).toBe("F2026-00001");
    const retriedIssue = await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/issue`)
      .set("idempotency-key", "issue-invoice-a")
      .send({ sequenceId: sequence.body.id })
      .expect(200);
    expect(retriedIssue.body.fullNumber).toBe(issuedInvoice.body.fullNumber);
    const originalLedger = await authed(accountA.accessToken, tenantA)
      .get("/v1/tax-ledger")
      .expect(200);
    expect(originalLedger.body.data).toHaveLength(1);
    expect(originalLedger.body.data[0]).toMatchObject({
      invoiceId: invoiceDraft.body.id,
      direction: "SALES",
      bookType: "ISSUED_INVOICES",
      documentNumber: "F2026-00001",
      correctionOfId: null,
    });
    expect(originalLedger.body.data[0].amounts[0]).toMatchObject({
      taxableBase: "100",
      rate: "21",
      taxAmount: "21",
    });
    await expect(
      admin.taxRule.update({
        where: { id: taxRules.body[0].id },
        data: { legalReference: "Tampered" },
      }),
    ).rejects.toThrow(/tax rules are immutable/);
    await expect(
      admin.invoiceTaxLine.update({
        where: { id: issuedInvoice.body.lines[0].taxLines[0].id },
        data: { taxAmount: "999" },
      }),
    ).rejects.toThrow(/issued invoice tax lines are immutable/);
    await expect(
      admin.taxLedgerEntry.update({
        where: { id: originalLedger.body.data[0].id },
        data: { documentNumber: "TAMPERED" },
      }),
    ).rejects.toThrow(/tax ledger is append-only/);
    await expect(
      admin.taxLedgerAmount.delete({
        where: { id: originalLedger.body.data[0].amounts[0].id },
      }),
    ).rejects.toThrow(/tax ledger is append-only/);
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/tax-ledger/${originalLedger.body.data[0].id}`)
      .expect(404);
    const issuedSchedule = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}/payment-schedule`)
      .expect(200);
    expect(issuedSchedule.body).toHaveLength(2);
    await authed(accountA.accessToken, tenantA)
      .put(`/v1/invoices/${invoiceDraft.body.id}/payment-schedule`)
      .send({ installments: [{ dueDate: "2026-10-31", amount: 121 }] })
      .expect(409);
    const invoicePdf = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}/pdf`)
      .expect("content-type", /application\/pdf/)
      .expect(
        "content-disposition",
        'attachment; filename="factura-F2026-00001.pdf"',
      )
      .expect(200);
    expect(invoicePdf.body.subarray(0, 5).toString()).toBe("%PDF-");
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/email`)
      .send({})
      .expect(400);
    const queuedEmails = await Promise.all([
      authed(accountA.accessToken, tenantA)
        .post(`/v1/invoices/${invoiceDraft.body.id}/email`)
        .set("idempotency-key", "email-invoice-a")
        .send({})
        .expect(202),
      authed(accountA.accessToken, tenantA)
        .post(`/v1/invoices/${invoiceDraft.body.id}/email`)
        .set("idempotency-key", "email-invoice-a")
        .send({})
        .expect(202),
    ]);
    const [queuedEmail, retriedEmail] = queuedEmails;
    expect(queuedEmail.body).toMatchObject({
      invoiceId: invoiceDraft.body.id,
      recipient: "billing-a@example.com",
      status: "PENDING",
      attempts: 0,
    });
    expect(retriedEmail.body.id).toBe(queuedEmail.body.id);
    const deliveries = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}/email-deliveries`)
      .expect(200);
    expect(deliveries.body).toHaveLength(1);
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/invoices/${invoiceDraft.body.id}/email-deliveries`)
      .expect(404);
    const firstPaymentInput = {
      amount: 60.5,
      paidAt: "2026-09-15T10:00:00.000Z",
      method: "BANK_TRANSFER",
      reference: "TRANSFER-001",
    };
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/payments`)
      .send(firstPaymentInput)
      .expect(400);
    const firstPayment = await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/payments`)
      .set("idempotency-key", "payment-invoice-a-1")
      .send(firstPaymentInput)
      .expect(201);
    expect(firstPayment.body.allocations).toHaveLength(1);
    expect(firstPayment.body.allocations[0].amount).toBe("60.5");
    await expect(
      admin.payment.update({
        where: { id: firstPayment.body.id },
        data: { reference: "TAMPERED" },
      }),
    ).rejects.toThrow(/recorded payments and allocations are immutable/);
    await expect(
      admin.paymentAllocation.update({
        where: { id: firstPayment.body.allocations[0].id },
        data: { amount: "1" },
      }),
    ).rejects.toThrow(/recorded payments and allocations are immutable/);
    const retriedPayment = await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/payments`)
      .set("idempotency-key", "payment-invoice-a-1")
      .send(firstPaymentInput)
      .expect(201);
    expect(retriedPayment.body.id).toBe(firstPayment.body.id);
    const partlyPaidInvoice = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}`)
      .expect(200);
    expect(partlyPaidInvoice.body).toMatchObject({
      status: "PARTIALLY_PAID",
      amountPaid: "60.5",
      amountDue: "60.5",
    });
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/payments`)
      .set("idempotency-key", "payment-invoice-a-overpay")
      .send({ ...firstPaymentInput, amount: 61 })
      .expect(400);
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/invoices/${invoiceDraft.body.id}/payments`)
      .expect(404);
    const finalPaymentAttempts = await Promise.all([
      authed(accountA.accessToken, tenantA)
        .post(`/v1/invoices/${invoiceDraft.body.id}/payments`)
        .set("idempotency-key", "payment-invoice-a-2")
        .send({
          ...firstPaymentInput,
          paidAt: "2026-10-15T10:00:00.000Z",
          reference: "TRANSFER-002",
        }),
      authed(accountA.accessToken, tenantA)
        .post(`/v1/invoices/${invoiceDraft.body.id}/payments`)
        .set("idempotency-key", "payment-invoice-a-competing")
        .send({
          ...firstPaymentInput,
          paidAt: "2026-10-15T10:01:00.000Z",
          reference: "TRANSFER-COMPETING",
        }),
    ]);
    expect(finalPaymentAttempts.map(({ status }) => status).sort()).toEqual([
      201, 409,
    ]);
    const payments = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}/payments`)
      .expect(200);
    expect(payments.body).toHaveLength(2);
    const paidInvoice = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}`)
      .expect(200);
    expect(paidInvoice.body).toMatchObject({
      status: "PAID",
      amountPaid: "121",
      amountDue: "0",
    });
    await authed(accountB.accessToken, tenantB)
      .post(`/v1/invoices/${invoiceDraft.body.id}/rectifications`)
      .send({
        kind: "TOTAL",
        impact: "DECREASE",
        reason: "Incorrect customer operation",
        issueDate: "2026-09-09",
      })
      .expect(404);
    const rectification = await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/rectifications`)
      .send({
        kind: "TOTAL",
        impact: "DECREASE",
        reason: "Incorrect customer operation",
        issueDate: "2026-09-09",
      })
      .expect(201);
    expect(rectification.body).toMatchObject({
      documentType: "CREDIT_NOTE",
      rectificationKind: "TOTAL",
      rectificationImpact: "DECREASE",
      originalInvoiceId: invoiceDraft.body.id,
      total: "121",
      status: "DRAFT",
    });
    expect(rectification.body.originalInvoice.fullNumber).toBe("F2026-00001");
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${rectification.body.id}/issue`)
      .set("idempotency-key", "issue-rectification-a")
      .send({ sequenceId: sequence.body.id })
      .expect(400);
    const issuedRectification = await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${rectification.body.id}/issue`)
      .set("idempotency-key", "issue-rectification-a")
      .send({ sequenceId: creditSequence.body.id })
      .expect(200);
    expect(issuedRectification.body.fullNumber).toBe("R2026-00001");
    const rectificationLedger = await authed(accountA.accessToken, tenantA)
      .get("/v1/tax-ledger")
      .expect(200);
    expect(rectificationLedger.body.data).toHaveLength(2);
    expect(rectificationLedger.body.data[0]).toMatchObject({
      invoiceId: rectification.body.id,
      documentNumber: "R2026-00001",
      correctionOfId: originalLedger.body.data[0].id,
      rectificationImpact: "DECREASE",
    });
    expect(rectificationLedger.body.data[0].amounts[0]).toMatchObject({
      taxableBase: "-100",
      rate: "21",
      taxAmount: "-21",
    });
    await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${rectification.body.id}/pdf`)
      .expect("content-type", /application\/pdf/)
      .expect(200);
    const rectifiedOriginal = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}`)
      .expect(200);
    expect(rectifiedOriginal.body.status).toBe("RECTIFIED");
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${invoiceDraft.body.id}/rectifications`)
      .send({
        kind: "PARTIAL",
        impact: "DECREASE",
        reason: "Second correction is not allowed",
        issueDate: "2026-09-10",
        lines: invoice(contactA.body.id).lines,
      })
      .expect(409);
    await authed(accountA.accessToken, tenantA)
      .patch(`/v1/invoices/${invoiceDraft.body.id}`)
      .send(invoice(contactA.body.id))
      .expect(409);
    await authed(accountA.accessToken, tenantA)
      .delete(`/v1/invoices/${invoiceDraft.body.id}`)
      .expect(409);
    const disposableInvoice = await authed(accountA.accessToken, tenantA)
      .post("/v1/invoices")
      .send(invoice(contactA.body.id))
      .expect(201);
    await authed(accountA.accessToken, tenantA)
      .delete(`/v1/invoices/${disposableInvoice.body.id}`)
      .expect(204);

    const transitions = await Promise.all([
      authed(accountA.accessToken, tenantA)
        .post(`/v1/quotes/${createdQuote.body.id}/status`)
        .send({ expectedStatus: "DRAFT", status: "SENT" }),
      authed(accountA.accessToken, tenantA)
        .post(`/v1/quotes/${createdQuote.body.id}/status`)
        .send({ expectedStatus: "DRAFT", status: "CANCELLED" }),
    ]);
    expect(transitions.map(({ status }) => status).sort()).toEqual([200, 409]);

    const refreshes = await Promise.all([
      request(app.getHttpServer())
        .post("/v1/identity/refresh")
        .send({ refreshToken: accountA.refreshToken }),
      request(app.getHttpServer())
        .post("/v1/identity/refresh")
        .send({ refreshToken: accountA.refreshToken }),
    ]);
    expect(refreshes.map(({ status }) => status).sort()).toEqual([200, 401]);
    const rotated = refreshes.find(({ status }) => status === 200)!.body;
    await request(app.getHttpServer())
      .post("/v1/identity/logout")
      .set("authorization", `Bearer ${rotated.accessToken}`)
      .expect(204);
    await authed(rotated.accessToken, tenantA).get("/v1/contacts").expect(401);

    await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT set_config('app.organization_id', ${tenantA.organizationId}, true)`;
      expect(await db.contact.count({ where: { id: contactA.body.id } })).toBe(
        1,
      );
      expect(await db.contact.count({ where: { id: contactB.body.id } })).toBe(
        0,
      );
      expect(
        await db.auditEvent.count({ where: { entityId: contactA.body.id } }),
      ).toBeGreaterThan(0);
    });
  });

  async function register(
    email: string,
    organizationName: string,
    legalName: string,
    taxId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post("/v1/identity/register")
      .send({
        email,
        password: "correct horse battery staple",
        organizationName,
        legalName,
        taxId,
      })
      .expect(201);
    return response.body as { accessToken: string; refreshToken: string };
  }
  async function tenantFor(email: string) {
    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email } },
    });
    return {
      organizationId: membership.organizationId,
      companyId: membership.companyId!,
    };
  }
  function authed(
    token: string,
    tenant: { organizationId: string; companyId: string },
  ) {
    const apply = <T extends SupertestTest>(call: T) =>
      call
        .set("authorization", `Bearer ${token}`)
        .set("x-organization-id", tenant.organizationId)
        .set("x-company-id", tenant.companyId);
    return {
      get: (path: string) => apply(request(app.getHttpServer()).get(path)),
      post: (path: string) => apply(request(app.getHttpServer()).post(path)),
      put: (path: string) => apply(request(app.getHttpServer()).put(path)),
      patch: (path: string) => apply(request(app.getHttpServer()).patch(path)),
      delete: (path: string) =>
        apply(request(app.getHttpServer()).delete(path)),
    };
  }
  function quote(contactId: string, catalogItemId?: string) {
    return {
      contactId,
      issueDate: "2026-09-08",
      validUntil: "2026-10-08",
      currency: "EUR",
      lines: [
        {
          ...(catalogItemId ? { catalogItemId } : {}),
          description: "Consulting",
          quantity: 1,
          unitPrice: 100,
          taxRate: 21,
        },
      ],
    };
  }
  function invoice(contactId: string) {
    return {
      contactId,
      issueDate: "2026-09-08",
      dueDate: "2026-10-08",
      currency: "EUR",
      lines: [
        {
          description: "Consulting",
          quantity: 1,
          unitPrice: 100,
          taxRate: 21,
        },
      ],
    };
  }
});
