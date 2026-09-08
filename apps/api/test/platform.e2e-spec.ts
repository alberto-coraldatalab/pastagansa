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

    const transitions = await Promise.all([
      authed(accountA.accessToken, tenantA)
        .post(`/v1/quotes/${createdQuote.body.id}/status`)
        .send({ status: "SENT" }),
      authed(accountA.accessToken, tenantA)
        .post(`/v1/quotes/${createdQuote.body.id}/status`)
        .send({ status: "CANCELLED" }),
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
});
