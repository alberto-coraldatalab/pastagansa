import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request = require("supertest");
import { AppModule } from "../src/app.module";
import { InvoicesService } from "../src/invoices/invoices.service";
import { TenantContextService } from "../src/tenancy/tenant-context.service";

jest.setTimeout(120_000);

describe("invoice issuance concurrency", () => {
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

  it("allocates 100 unique numbers and rolls back a losing idempotency race", async () => {
    const account = await request(app.getHttpServer())
      .post("/v1/identity/register")
      .send({
        email: "issuer@example.com",
        password: "correct horse battery staple",
        organizationName: "Issuance Org",
        legalName: "Issuance Company",
        taxId: "B12345674",
      })
      .expect(201);
    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email: "issuer@example.com" } },
    });
    const tenant = {
      organizationId: membership.organizationId,
      companyId: membership.companyId!,
      userId: membership.userId,
    };
    const contact = await tenantRequest(account.body.accessToken, tenant)
      .post("/v1/contacts")
      .send({ legalName: "Concurrency Customer", isCustomer: true })
      .expect(201);
    const sequence = await tenantRequest(account.body.accessToken, tenant)
      .post("/v1/document-sequences")
      .send({ documentType: "INVOICE", series: "FC", padding: 4 })
      .expect(201);

    const draftCodes = Array.from({ length: 102 }, () => randomUUID());
    const drafts = await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT set_config('app.organization_id', ${tenant.organizationId}, true)`;
      await db.invoice.createMany({
        data: draftCodes.map((draftCode) => ({
          organizationId: tenant.organizationId,
          companyId: tenant.companyId,
          contactId: contact.body.id,
          draftCode,
          issuerLegalName: "Issuance Company",
          issuerTaxId: "B12345674",
          customerLegalName: "Concurrency Customer",
          issueDate: new Date("2026-09-08"),
          currency: "EUR",
          subtotal: "100",
          discountTotal: "0",
          taxTotal: "21",
          total: "121",
        })),
      });
      const created = await db.invoice.findMany({
        where: { companyId: tenant.companyId, draftCode: { in: draftCodes } },
        select: { id: true, draftCode: true },
      });
      await db.invoiceLine.createMany({
        data: created.map(({ id }) => ({
          invoiceId: id,
          organizationId: tenant.organizationId,
          companyId: tenant.companyId,
          position: 1,
          description: "Concurrent issuance test",
          quantity: "1",
          unitPrice: "100",
          discountPct: "0",
          taxRate: "21",
          netAmount: "100",
          taxAmount: "21",
          totalAmount: "121",
        })),
      });
      return draftCodes.map(
        (code) => created.find(({ draftCode }) => draftCode === code)!.id,
      );
    });

    const invoices = app.get(InvoicesService);
    const tenantContext = app.get(TenantContextService);
    const issue = (invoiceId: string, key: string) =>
      prisma.$transaction(
        async (db) => {
          await db.$queryRaw`SELECT set_config('app.organization_id', ${tenant.organizationId}, true)`;
          return tenantContext.run(
            {
              ...tenant,
              roleCodes: ["organization.owner"],
              db,
            },
            () =>
              invoices.issue(invoiceId, { sequenceId: sequence.body.id }, key),
          );
        },
        { maxWait: 60_000, timeout: 60_000 },
      );

    const issued = await Promise.all(
      drafts.slice(0, 100).map((id, index) => issue(id, `bulk-${index}`)),
    );
    const numbers = issued
      .map(({ number }) => Number(number))
      .sort((left, right) => left - right);
    expect(numbers).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    const retry = await issue(drafts[0], "bulk-0");
    expect(retry.fullNumber).toBe(issued[0].fullNumber);

    const collision = await Promise.allSettled([
      issue(drafts[100], "collision-key"),
      issue(drafts[101], "collision-key"),
    ]);
    expect(
      collision.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = collision.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({ reason: expect.any(ConflictException) });

    await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT set_config('app.organization_id', ${tenant.organizationId}, true)`;
      const current = await db.documentSequence.findUniqueOrThrow({
        where: { id: sequence.body.id },
      });
      expect(current.nextNumber).toBe(102n);
      expect(
        await db.invoice.count({
          where: { companyId: tenant.companyId, status: "ISSUED" },
        }),
      ).toBe(101);
    });
    await expect(
      admin.invoice.update({
        where: { id: drafts[0] },
        data: { total: "999" },
      }),
    ).rejects.toThrow(/issued invoice contents are immutable/);
    await expect(
      admin.invoice.delete({ where: { id: drafts[0] } }),
    ).rejects.toThrow(/issued invoices cannot be deleted/);
    const issuedLine = await admin.invoiceLine.findFirstOrThrow({
      where: { invoiceId: drafts[0] },
    });
    await expect(
      admin.invoiceLine.update({
        where: { id: issuedLine.id },
        data: { description: "Tampered" },
      }),
    ).rejects.toThrow(/issued invoice lines are immutable/);
    await expect(
      admin.invoiceLine.delete({ where: { id: issuedLine.id } }),
    ).rejects.toThrow(/issued invoice lines are immutable/);
  });

  function tenantRequest(
    token: string,
    tenant: { organizationId: string; companyId: string },
  ) {
    const apply = (call: request.Test) =>
      call
        .set("authorization", `Bearer ${token}`)
        .set("x-organization-id", tenant.organizationId)
        .set("x-company-id", tenant.companyId);
    return {
      post: (path: string) => apply(request(app.getHttpServer()).post(path)),
    };
  }
});
