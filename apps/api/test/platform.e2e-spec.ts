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
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/invoices/${invoiceDraft.body.id}`)
      .expect(404);
    const updatedInvoice = await authed(accountA.accessToken, tenantA)
      .patch(`/v1/invoices/${invoiceDraft.body.id}`)
      .send({ ...invoice(contactA.body.id), notes: "Updated draft" })
      .expect(200);
    expect(updatedInvoice.body.notes).toBe("Updated draft");
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
