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
    const generalTaxRule = taxRules.body.find(
      ({ code }: { code: string }) => code === "ES_VAT_GENERAL_21",
    );
    expect(generalTaxRule).toBeDefined();

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
    const supplierA = await authed(accountA.accessToken, tenantA)
      .post("/v1/contacts")
      .send({
        legalName: "Supplier A",
        taxId: "A58818501",
        isCustomer: false,
        isSupplier: true,
      })
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
    const purchaseSequence = await authed(accountA.accessToken, tenantA)
      .post("/v1/document-sequences")
      .send({
        documentType: "PURCHASE_INVOICE",
        series: "REC2026",
        padding: 5,
      })
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
    const salesEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=SALES_INVOICE")
      .expect(200);
    expect(salesEntries.body.data).toHaveLength(1);
    const originalSalesEntry = salesEntries.body.data[0];
    expect(originalSalesEntry).toMatchObject({
      status: "POSTED",
      sourceId: invoiceDraft.body.id,
      entryNumber: "1",
    });
    expect(accountingAmounts(originalSalesEntry)).toEqual({
      "430000": { debit: "121", credit: "0" },
      "477000": { debit: "0", credit: "21" },
      "700000": { debit: "0", credit: "100" },
    });
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/accounting/journal-entries/${originalSalesEntry.id}`)
      .expect(404);
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
    await expect(
      admin.journalEntry.update({
        where: { id: originalSalesEntry.id },
        data: { description: "Tampered" },
      }),
    ).rejects.toThrow(/posted journal entries are immutable/);
    await expect(
      admin.journalLine.update({
        where: { id: originalSalesEntry.lines[0].id },
        data: { debit: "999" },
      }),
    ).rejects.toThrow(/posted journal lines are immutable/);
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
    let paymentEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=PAYMENT")
      .expect(200);
    expect(paymentEntries.body.data).toHaveLength(1);
    expect(paymentEntries.body.data[0]).toMatchObject({
      sourceId: firstPayment.body.id,
      status: "POSTED",
      entryNumber: "2",
    });
    expect(accountingAmounts(paymentEntries.body.data[0])).toEqual({
      "430000": { debit: "0", credit: "60.5" },
      "572000": { debit: "60.5", credit: "0" },
    });
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
    paymentEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=PAYMENT")
      .expect(200);
    expect(paymentEntries.body.data).toHaveLength(1);
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
    paymentEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=PAYMENT")
      .expect(200);
    expect(paymentEntries.body.data).toHaveLength(2);
    const finalPayment = payments.body.find(
      ({ id }: { id: string }) => id !== firstPayment.body.id,
    );
    const finalPaymentEntry = paymentEntries.body.data.find(
      ({ sourceId }: { sourceId: string }) => sourceId === finalPayment.id,
    );
    expect(accountingAmounts(finalPaymentEntry)).toEqual({
      "430000": { debit: "0", credit: "60.5" },
      "572000": { debit: "60.5", credit: "0" },
    });
    const paidInvoice = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${invoiceDraft.body.id}`)
      .expect(200);
    expect(paidInvoice.body).toMatchObject({
      status: "PAID",
      amountPaid: "121",
      amountDue: "0",
    });
    const defaultAccountingRules = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/rules")
      .expect(200);
    expect(defaultAccountingRules.body).toHaveLength(10);
    expect(defaultAccountingRules.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "SALES_INVOICE",
          accountingRole: "SALES_REVENUE",
          account: expect.objectContaining({ code: "700000" }),
        }),
      ]),
    );
    const alternateRevenueAccount = await authed(accountA.accessToken, tenantA)
      .post("/v1/accounting/accounts")
      .send({
        code: "701000",
        name: "Ventas alternativas",
        accountClass: "INCOME",
      })
      .expect(201);
    await authed(accountA.accessToken, tenantA)
      .put("/v1/accounting/rules/PAYMENT/SALES_REVENUE")
      .send({ accountId: alternateRevenueAccount.body.id })
      .expect(400);
    await authed(accountB.accessToken, tenantB)
      .put("/v1/accounting/rules/SALES_INVOICE/SALES_REVENUE")
      .send({ accountId: alternateRevenueAccount.body.id })
      .expect(400);
    const updatedRevenueRule = await authed(accountA.accessToken, tenantA)
      .put("/v1/accounting/rules/SALES_INVOICE/SALES_REVENUE")
      .send({ accountId: alternateRevenueAccount.body.id })
      .expect(200);
    expect(updatedRevenueRule.body).toMatchObject({
      sourceType: "SALES_INVOICE",
      accountingRole: "SALES_REVENUE",
      account: { id: alternateRevenueAccount.body.id, code: "701000" },
    });
    const bankRule = defaultAccountingRules.body.find(
      ({ sourceType, accountingRole }: Record<string, string>) =>
        sourceType === "PAYMENT" && accountingRole === "BANK",
    );
    await expect(
      admin.accountingRule.update({
        where: { id: updatedRevenueRule.body.id },
        data: { accountId: bankRule.account.id },
      }),
    ).rejects.toThrow(
      /accounting rule requires an active account of the expected class/,
    );
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
    const rectificationEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=SALES_INVOICE")
      .expect(200);
    expect(rectificationEntries.body.data).toHaveLength(2);
    const rectificationEntry = rectificationEntries.body.data.find(
      ({ sourceId }: { sourceId: string }) =>
        sourceId === rectification.body.id,
    );
    expect(accountingAmounts(rectificationEntry)).toEqual({
      "430000": { debit: "0", credit: "121" },
      "477000": { debit: "21", credit: "0" },
      "701000": { debit: "100", credit: "0" },
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

    const purchaseInput = {
      supplierId: supplierA.body.id,
      supplierInvoiceNumber: "PROV-2026-0042",
      issueDate: "2026-09-01",
      operationDate: "2026-08-31",
      receivedDate: "2026-09-05",
      deductionDate: "2026-10-01",
      dueDate: "2026-10-31",
      currency: "EUR",
      lines: [
        {
          description: "Professional services",
          quantity: 1,
          unitPrice: 200,
          taxRuleId: generalTaxRule.id,
          taxRate: 21,
          deductiblePct: 50,
        },
      ],
    };
    const purchaseDraft = await authed(accountA.accessToken, tenantA)
      .post("/v1/purchase-invoices")
      .send(purchaseInput)
      .expect(201);
    expect(purchaseDraft.body).toMatchObject({
      status: "DRAFT",
      supplierInvoiceNumber: "PROV-2026-0042",
      supplierLegalName: "Supplier A",
      subtotal: "200",
      taxTotal: "42",
      deductibleTaxTotal: "21",
      total: "242",
      dueDate: "2026-10-31T00:00:00.000Z",
    });
    expect(purchaseDraft.body.lines[0].taxLines[0]).toMatchObject({
      taxCode: "ES_VAT_GENERAL_21",
      deductiblePct: "50",
      deductibleAmount: "21",
    });
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/purchase-invoices/${purchaseDraft.body.id}`)
      .expect(404);
    const purchasePdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF",
    );
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/attachments`)
      .attach("file", Buffer.from("not a pdf"), {
        filename: "fake.pdf",
        contentType: "application/pdf",
      })
      .expect(400);
    const purchaseAttachment = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/attachments`)
      .attach("file", purchasePdf, {
        filename: "../supplier-invoice.pdf",
        contentType: "application/pdf",
      })
      .expect(201);
    expect(purchaseAttachment.body).toMatchObject({
      purchaseInvoiceId: purchaseDraft.body.id,
      originalName: "supplier-invoice.pdf",
      mediaType: "application/pdf",
      sizeBytes: purchasePdf.length,
    });
    expect(purchaseAttachment.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(purchaseAttachment.body).not.toHaveProperty("content");
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/attachments`)
      .attach("file", purchasePdf, {
        filename: "duplicate.pdf",
        contentType: "application/pdf",
      })
      .expect(409);
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/purchase-invoices/${purchaseDraft.body.id}/attachments`)
      .expect(404);
    await authed(accountB.accessToken, tenantB)
      .get(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/attachments/${purchaseAttachment.body.id}/download`,
      )
      .expect(404);
    const purchaseAttachments = await authed(accountA.accessToken, tenantA)
      .get(`/v1/purchase-invoices/${purchaseDraft.body.id}/attachments`)
      .expect(200);
    expect(purchaseAttachments.body).toHaveLength(1);
    expect(purchaseAttachments.body[0]).not.toHaveProperty("content");
    const downloadedPurchaseAttachment = await authed(
      accountA.accessToken,
      tenantA,
    )
      .get(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/attachments/${purchaseAttachment.body.id}/download`,
      )
      .expect("content-type", /application\/pdf/)
      .expect(
        "content-disposition",
        'attachment; filename="supplier-invoice.pdf"',
      )
      .expect(200);
    expect(downloadedPurchaseAttachment.body).toEqual(purchasePdf);
    const temporaryAttachment = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/attachments`)
      .attach(
        "file",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        { filename: "temporary.png", contentType: "image/png" },
      )
      .expect(201);
    await authed(accountA.accessToken, tenantA)
      .delete(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/attachments/${temporaryAttachment.body.id}`,
      )
      .expect(204);
    await authed(accountA.accessToken, tenantA)
      .get(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/attachments/${temporaryAttachment.body.id}/download`,
      )
      .expect(404);
    await authed(accountA.accessToken, tenantA)
      .post(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/ocr/attachments/${purchaseAttachment.body.id}`,
      )
      .expect(400);
    const ocrAttachment = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/attachments`)
      .attach(
        "file",
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
        ]),
        { filename: "invoice-scan.png", contentType: "image/png" },
      )
      .expect(201);
    const ocrJob = await authed(accountA.accessToken, tenantA)
      .post(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/ocr/attachments/${ocrAttachment.body.id}`,
      )
      .expect(201);
    expect(ocrJob.body).toMatchObject({
      status: "PENDING",
      engine: "tesseract.js",
      engineVersion: "7.0.0",
      attempts: 0,
    });
    await authed(accountA.accessToken, tenantA)
      .post(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/ocr/attachments/${ocrAttachment.body.id}`,
      )
      .expect(409);
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/purchase-invoices/${purchaseDraft.body.id}/ocr/${ocrJob.body.id}`)
      .expect(404);
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/approve`)
      .set("idempotency-key", "approve-before-ocr-review")
      .send({ sequenceId: purchaseSequence.body.id })
      .expect(409);
    await admin.purchaseInvoiceOcrJob.update({
      where: { id: ocrJob.body.id },
      data: {
        status: "REVIEW_REQUIRED",
        attempts: 1,
        rawText: "FACTURA: PROV-2026-0042\nTOTAL: 242,00 EUR",
        extractedFields: {
          invoiceNumber: {
            value: "PROV-2026-0042",
            confidence: 91.25,
            evidence: "FACTURA: PROV-2026-0042",
          },
          total: {
            value: "242.00",
            confidence: 91.25,
            evidence: "TOTAL: 242,00 EUR",
          },
        },
        overallConfidence: 91.25,
      },
    });
    const extractedOcr = await authed(accountA.accessToken, tenantA)
      .get(`/v1/purchase-invoices/${purchaseDraft.body.id}/ocr/${ocrJob.body.id}`)
      .expect(200);
    expect(extractedOcr.body).toMatchObject({
      status: "REVIEW_REQUIRED",
      overallConfidence: "91.25",
      rawText: "FACTURA: PROV-2026-0042\nTOTAL: 242,00 EUR",
    });
    await authed(accountA.accessToken, tenantA)
      .post(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/ocr/${ocrJob.body.id}/review`,
      )
      .send({ fields: { executable: "no" }, notes: "Invalid field" })
      .expect(400);
    const reviewedOcr = await authed(accountA.accessToken, tenantA)
      .post(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/ocr/${ocrJob.body.id}/review`,
      )
      .send({
        fields: { invoiceNumber: "PROV-2026-0042", total: "242.00" },
        notes: "Compared with the original document",
      })
      .expect(201);
    expect(reviewedOcr.body).toMatchObject({
      status: "REVIEWED",
      reviewFields: {
        fields: { invoiceNumber: "PROV-2026-0042", total: "242.00" },
        notes: "Compared with the original document",
      },
    });
    await expect(
      admin.purchaseInvoiceOcrJob.update({
        where: { id: ocrJob.body.id },
        data: { overallConfidence: 100 },
      }),
    ).rejects.toThrow(/reviewed OCR records are immutable/);
    await authed(accountA.accessToken, tenantA)
      .post("/v1/purchase-invoices")
      .send(purchaseInput)
      .expect(409);
    await authed(accountA.accessToken, tenantA)
      .put(`/v1/purchase-invoices/${purchaseDraft.body.id}/payment-schedule`)
      .send({
        installments: [
          { dueDate: "2026-09-30", amount: 100 },
          { dueDate: "2026-10-31", amount: 100 },
        ],
      })
      .expect(400);
    const purchaseSchedule = await authed(accountA.accessToken, tenantA)
      .put(`/v1/purchase-invoices/${purchaseDraft.body.id}/payment-schedule`)
      .send({
        installments: [
          { dueDate: "2026-09-30", amount: 100 },
          { dueDate: "2026-10-31", amount: 142 },
        ],
      })
      .expect(200);
    expect(purchaseSchedule.body.installments).toHaveLength(2);
    expect(purchaseSchedule.body.installments[1]).toMatchObject({
      position: 2,
      amount: "142",
      paidAmount: "0",
      status: "PENDING",
    });
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/approve`)
      .set("idempotency-key", "approve-purchase-a")
      .send({ sequenceId: sequence.body.id })
      .expect(400);
    const approvedPurchase = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/approve`)
      .set("idempotency-key", "approve-purchase-a")
      .send({ sequenceId: purchaseSequence.body.id })
      .expect(200);
    expect(approvedPurchase.body).toMatchObject({
      status: "APPROVED",
      receptionNumber: "1",
      receptionFullNumber: "REC2026-00001",
      amountPaid: "0",
      amountDue: "242",
    });
    expect(approvedPurchase.body.installments).toHaveLength(2);
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/attachments`)
      .attach("file", Buffer.from("%PDF-1.4\nsecond\n%%EOF"), {
        filename: "second.pdf",
        contentType: "application/pdf",
      })
      .expect(409);
    await authed(accountA.accessToken, tenantA)
      .delete(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/attachments/${purchaseAttachment.body.id}`,
      )
      .expect(409);
    await authed(accountA.accessToken, tenantA)
      .get(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/attachments/${purchaseAttachment.body.id}/download`,
      )
      .expect(200);
    await expect(
      admin.purchaseInvoiceAttachment.update({
        where: { id: purchaseAttachment.body.id },
        data: { originalName: "tampered.pdf" },
      }),
    ).rejects.toThrow(/purchase invoice attachments are immutable/);
    await authed(accountA.accessToken, tenantA)
      .put(`/v1/purchase-invoices/${purchaseDraft.body.id}/payment-schedule`)
      .send({ installments: [{ dueDate: "2026-10-31", amount: 242 }] })
      .expect(409);
    await authed(accountB.accessToken, tenantB)
      .get(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/payment-schedule?asOf=2026-10-15`,
      )
      .expect(404);
    const overduePurchaseSchedule = await authed(accountA.accessToken, tenantA)
      .get(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/payment-schedule?asOf=2026-10-15`,
      )
      .expect(200);
    expect(overduePurchaseSchedule.body.asOf).toBe("2026-10-15");
    expect(
      overduePurchaseSchedule.body.installments.map(
        ({ overdue }: { overdue: boolean }) => overdue,
      ),
    ).toEqual([true, false]);
    await expect(
      admin.purchaseInvoiceInstallment.update({
        where: { id: approvedPurchase.body.installments[0].id },
        data: { dueDate: new Date("2026-12-31") },
      }),
    ).rejects.toThrow(
      /approved purchase invoice payment schedules are immutable/,
    );
    const retriedPurchaseApproval = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/approve`)
      .set("idempotency-key", "approve-purchase-a")
      .send({ sequenceId: purchaseSequence.body.id })
      .expect(200);
    expect(retriedPurchaseApproval.body.receptionFullNumber).toBe(
      "REC2026-00001",
    );
    const purchaseLedger = await authed(accountA.accessToken, tenantA)
      .get("/v1/tax-ledger?direction=PURCHASES")
      .expect(200);
    expect(purchaseLedger.body.data).toHaveLength(1);
    expect(purchaseLedger.body.data[0]).toMatchObject({
      purchaseInvoiceId: purchaseDraft.body.id,
      invoiceId: null,
      direction: "PURCHASES",
      bookType: "RECEIVED_INVOICES",
      documentNumber: "PROV-2026-0042",
      registrationNumber: "REC2026-00001",
      receivedDate: "2026-09-05T00:00:00.000Z",
      taxPointDate: "2026-10-01T00:00:00.000Z",
    });
    expect(purchaseLedger.body.data[0].amounts[0]).toMatchObject({
      taxableBase: "200",
      rate: "21",
      taxAmount: "42",
      deductibleAmount: "21",
    });
    const purchaseEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=PURCHASE_INVOICE")
      .expect(200);
    expect(purchaseEntries.body.data).toHaveLength(1);
    expect(purchaseEntries.body.data[0]).toMatchObject({
      status: "POSTED",
      sourceId: purchaseDraft.body.id,
      entryNumber: "5",
    });
    expect(accountingAmounts(purchaseEntries.body.data[0])).toEqual({
      "400000": { debit: "0", credit: "242" },
      "472000": { debit: "21", credit: "0" },
      "600000": { debit: "221", credit: "0" },
    });
    const supplierPaymentInput = {
      amount: 100,
      paidAt: "2026-10-10T10:00:00.000Z",
      method: "BANK_TRANSFER",
      reference: "SUPPLIER-TRANSFER-001",
    };
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/payments`)
      .send(supplierPaymentInput)
      .expect(400);
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/purchase-invoices/${purchaseDraft.body.id}/payments`)
      .expect(404);
    const firstSupplierPayment = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/payments`)
      .set("idempotency-key", "supplier-payment-a-1")
      .send(supplierPaymentInput)
      .expect(201);
    expect(firstSupplierPayment.body).toMatchObject({
      purchaseInvoiceId: purchaseDraft.body.id,
      amount: "100",
      currency: "EUR",
    });
    expect(firstSupplierPayment.body.allocations).toHaveLength(1);
    expect(firstSupplierPayment.body.allocations[0].amount).toBe("100");
    const partlyPaidPurchaseSchedule = await authed(
      accountA.accessToken,
      tenantA,
    )
      .get(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/payment-schedule?asOf=2026-10-15`,
      )
      .expect(200);
    expect(partlyPaidPurchaseSchedule.body.installments).toEqual([
      expect.objectContaining({
        status: "PAID",
        paidAmount: "100",
        overdue: false,
      }),
      expect.objectContaining({
        status: "PENDING",
        paidAmount: "0",
        overdue: false,
      }),
    ]);
    let supplierPaymentEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=SUPPLIER_PAYMENT")
      .expect(200);
    expect(supplierPaymentEntries.body.data).toHaveLength(1);
    expect(supplierPaymentEntries.body.data[0]).toMatchObject({
      sourceId: firstSupplierPayment.body.id,
      status: "POSTED",
      entryNumber: "6",
    });
    expect(accountingAmounts(supplierPaymentEntries.body.data[0])).toEqual({
      "400000": { debit: "100", credit: "0" },
      "572000": { debit: "0", credit: "100" },
    });
    await expect(
      admin.supplierPayment.update({
        where: { id: firstSupplierPayment.body.id },
        data: { reference: "TAMPERED" },
      }),
    ).rejects.toThrow(/recorded supplier payments are immutable/);
    await expect(
      admin.supplierPaymentAllocation.update({
        where: { id: firstSupplierPayment.body.allocations[0].id },
        data: { amount: "1" },
      }),
    ).rejects.toThrow(/recorded supplier payment allocations are immutable/);
    const retriedSupplierPayment = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/payments`)
      .set("idempotency-key", "supplier-payment-a-1")
      .send(supplierPaymentInput)
      .expect(201);
    expect(retriedSupplierPayment.body.id).toBe(firstSupplierPayment.body.id);
    supplierPaymentEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=SUPPLIER_PAYMENT")
      .expect(200);
    expect(supplierPaymentEntries.body.data).toHaveLength(1);
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/payments`)
      .set("idempotency-key", "supplier-payment-a-overpay")
      .send({ ...supplierPaymentInput, amount: 143 })
      .expect(400);
    const finalSupplierAttempts = await Promise.all([
      authed(accountA.accessToken, tenantA)
        .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/payments`)
        .set("idempotency-key", "supplier-payment-a-2")
        .send({
          ...supplierPaymentInput,
          amount: 142,
          reference: "SUPPLIER-TRANSFER-002",
        }),
      authed(accountA.accessToken, tenantA)
        .post(`/v1/purchase-invoices/${purchaseDraft.body.id}/payments`)
        .set("idempotency-key", "supplier-payment-a-competing")
        .send({
          ...supplierPaymentInput,
          amount: 142,
          reference: "SUPPLIER-TRANSFER-COMPETING",
        }),
    ]);
    expect(finalSupplierAttempts.map(({ status }) => status).sort()).toEqual([
      201, 409,
    ]);
    const supplierPayments = await authed(accountA.accessToken, tenantA)
      .get(`/v1/purchase-invoices/${purchaseDraft.body.id}/payments`)
      .expect(200);
    expect(supplierPayments.body).toHaveLength(2);
    const paidPurchase = await authed(accountA.accessToken, tenantA)
      .get(`/v1/purchase-invoices/${purchaseDraft.body.id}`)
      .expect(200);
    expect(paidPurchase.body).toMatchObject({
      status: "APPROVED",
      amountPaid: "242",
      amountDue: "0",
    });
    const paidPurchaseSchedule = await authed(accountA.accessToken, tenantA)
      .get(
        `/v1/purchase-invoices/${purchaseDraft.body.id}/payment-schedule?asOf=2026-12-31`,
      )
      .expect(200);
    expect(paidPurchaseSchedule.body.installments).toEqual([
      expect.objectContaining({
        status: "PAID",
        paidAmount: "100",
        overdue: false,
      }),
      expect.objectContaining({
        status: "PAID",
        paidAmount: "142",
        overdue: false,
      }),
    ]);
    supplierPaymentEntries = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/journal-entries?sourceType=SUPPLIER_PAYMENT")
      .expect(200);
    expect(supplierPaymentEntries.body.data).toHaveLength(2);
    const finalSupplierPayment = supplierPayments.body.find(
      ({ id }: { id: string }) => id !== firstSupplierPayment.body.id,
    );
    const finalSupplierEntry = supplierPaymentEntries.body.data.find(
      ({ sourceId }: { sourceId: string }) =>
        sourceId === finalSupplierPayment.id,
    );
    expect(accountingAmounts(finalSupplierEntry)).toEqual({
      "400000": { debit: "142", credit: "0" },
      "572000": { debit: "0", credit: "142" },
    });

    const accountingAccounts = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/accounts")
      .expect(200);
    const bankAccountingAccount = accountingAccounts.body.find(
      ({ code }: { code: string }) => code === "572000",
    );
    const customerAccountingAccount = accountingAccounts.body.find(
      ({ code }: { code: string }) => code === "430000",
    );
    await authed(accountA.accessToken, tenantA)
      .post("/v1/banking/accounts")
      .send({
        accountId: customerAccountingAccount.id,
        name: "Invalid bank ledger",
        currency: "EUR",
      })
      .expect(400);
    await authed(accountA.accessToken, tenantA)
      .post("/v1/banking/accounts")
      .send({
        accountId: bankAccountingAccount.id,
        name: "Invalid IBAN",
        iban: "ES00 2100 0418 4502 0005 1332",
        currency: "EUR",
      })
      .expect(400);
    const createdBankAccount = await authed(accountA.accessToken, tenantA)
      .post("/v1/banking/accounts")
      .send({
        accountId: bankAccountingAccount.id,
        name: "Operating account",
        iban: "ES91 2100 0418 4502 0005 1332",
        currency: "EUR",
      })
      .expect(201);
    expect(createdBankAccount.body).toMatchObject({
      accountId: bankAccountingAccount.id,
      iban: "ES9121000418450200051332",
      currency: "EUR",
    });
    await expect(
      admin.bankAccount.update({
        where: { id: createdBankAccount.body.id },
        data: { accountId: customerAccountingAccount.id },
      }),
    ).rejects.toThrow(/bank account ledger mapping and currency are immutable/);
    await authed(accountA.accessToken, tenantA)
      .post("/v1/banking/accounts")
      .send({
        accountId: bankAccountingAccount.id,
        name: "Duplicate operating account",
      })
      .expect(409);
    const bankImport = {
      bankAccountId: createdBankAccount.body.id,
      transactions: [
        {
          externalId: "BANK-CUSTOMER-001",
          bookingDate: "2026-09-15",
          valueDate: "2026-09-15",
          amount: 60.5,
          description: "Incoming transfer F2026-00001",
          counterpartyName: "Customer A",
          reference: "F2026-00001",
        },
        {
          externalId: "BANK-SUPPLIER-001",
          bookingDate: "2026-10-10",
          amount: -100,
          description: "Outgoing transfer PROV-2026-0042",
          counterpartyName: "Supplier A",
          reference: "PROV-2026-0042",
        },
      ],
    };
    const importedBankTransactions = await authed(accountA.accessToken, tenantA)
      .post("/v1/banking/transactions/import")
      .send(bankImport)
      .expect(201);
    expect(importedBankTransactions.body).toHaveLength(2);
    expect(
      importedBankTransactions.body.map(
        ({ status }: { status: string }) => status,
      ),
    ).toEqual(["UNMATCHED", "UNMATCHED"]);
    await authed(accountA.accessToken, tenantA)
      .post("/v1/banking/transactions/import")
      .send(bankImport)
      .expect(409);
    const customerBankTransaction = importedBankTransactions.body.find(
      ({ externalId }: { externalId: string }) =>
        externalId === "BANK-CUSTOMER-001",
    );
    const supplierBankTransaction = importedBankTransactions.body.find(
      ({ externalId }: { externalId: string }) =>
        externalId === "BANK-SUPPLIER-001",
    );
    await authed(accountB.accessToken, tenantB)
      .get(`/v1/banking/transactions/${customerBankTransaction.id}/suggestions`)
      .expect(404);
    const customerSuggestions = await authed(accountA.accessToken, tenantA)
      .get(`/v1/banking/transactions/${customerBankTransaction.id}/suggestions`)
      .expect(200);
    const firstCustomerEntry = paymentEntries.body.data.find(
      ({ sourceId }: { sourceId: string }) => sourceId === firstPayment.body.id,
    );
    const customerBankLine = firstCustomerEntry.lines.find(
      ({ account }: { account: { code: string } }) => account.code === "572000",
    );
    expect(customerSuggestions.body[0]).toMatchObject({
      journalLineId: customerBankLine.id,
      score: 100,
      debit: "60.5",
      credit: "0",
    });
    const customerReconciliation = await authed(accountA.accessToken, tenantA)
      .post(`/v1/banking/transactions/${customerBankTransaction.id}/reconcile`)
      .send({ journalLineId: customerBankLine.id })
      .expect(200);
    const retriedReconciliation = await authed(accountA.accessToken, tenantA)
      .post(`/v1/banking/transactions/${customerBankTransaction.id}/reconcile`)
      .send({ journalLineId: customerBankLine.id })
      .expect(200);
    expect(retriedReconciliation.body.id).toBe(customerReconciliation.body.id);
    await expect(
      admin.bankReconciliation.update({
        where: { id: customerReconciliation.body.id },
        data: { reconciledAt: new Date() },
      }),
    ).rejects.toThrow(/bank reconciliations are append-only/);
    await expect(
      admin.bankTransaction.update({
        where: { id: customerBankTransaction.id },
        data: { description: "TAMPERED" },
      }),
    ).rejects.toThrow(/imported bank transaction contents are immutable/);
    await expect(
      admin.bankReconciliation.create({
        data: {
          organizationId: tenantA.organizationId,
          companyId: tenantA.companyId,
          bankTransactionId: supplierBankTransaction.id,
          journalLineId: customerBankLine.id,
          reconciledById: tenantA.userId,
        },
      }),
    ).rejects.toThrow(
      /bank reconciliation must match an unreconciled transaction to an equal posted bank line/,
    );
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/banking/transactions/${supplierBankTransaction.id}/reconcile`)
      .send({ journalLineId: customerBankLine.id })
      .expect(409);
    const supplierSuggestions = await authed(accountA.accessToken, tenantA)
      .get(`/v1/banking/transactions/${supplierBankTransaction.id}/suggestions`)
      .expect(200);
    const firstSupplierEntry = supplierPaymentEntries.body.data.find(
      ({ sourceId }: { sourceId: string }) =>
        sourceId === firstSupplierPayment.body.id,
    );
    const supplierBankLine = firstSupplierEntry.lines.find(
      ({ account }: { account: { code: string } }) => account.code === "572000",
    );
    expect(supplierSuggestions.body[0]).toMatchObject({
      journalLineId: supplierBankLine.id,
      score: 100,
      debit: "0",
      credit: "100",
    });
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/banking/transactions/${supplierBankTransaction.id}/reconcile`)
      .send({ journalLineId: supplierBankLine.id })
      .expect(200);
    const reconciledTransactions = await authed(accountA.accessToken, tenantA)
      .get("/v1/banking/transactions?status=RECONCILED")
      .expect(200);
    expect(reconciledTransactions.body.data).toHaveLength(2);
    await expect(
      admin.purchaseInvoice.update({
        where: { id: purchaseDraft.body.id },
        data: { supplierInvoiceNumber: "TAMPERED" },
      }),
    ).rejects.toThrow(/approved purchase invoices are immutable/);
    await authed(accountA.accessToken, tenantA)
      .delete(`/v1/purchase-invoices/${purchaseDraft.body.id}`)
      .expect(409);
    const disposablePurchase = await authed(accountA.accessToken, tenantA)
      .post("/v1/purchase-invoices")
      .send({ ...purchaseInput, supplierInvoiceNumber: "PROV-2026-0043" })
      .expect(201);
    const updatedPurchase = await authed(accountA.accessToken, tenantA)
      .patch(`/v1/purchase-invoices/${disposablePurchase.body.id}`)
      .send({
        ...purchaseInput,
        supplierInvoiceNumber: "PROV-2026-0044",
        notes: "Reviewed before approval",
      })
      .expect(200);
    expect(updatedPurchase.body.notes).toBe("Reviewed before approval");
    const searchedPurchases = await authed(accountA.accessToken, tenantA)
      .get("/v1/purchase-invoices?search=0044")
      .expect(200);
    expect(searchedPurchases.body.data).toHaveLength(1);
    await authed(accountA.accessToken, tenantA)
      .delete(`/v1/purchase-invoices/${disposablePurchase.body.id}`)
      .expect(204);
    await authed(accountA.accessToken, tenantA)
      .get(`/v1/purchase-invoices/${disposablePurchase.body.id}`)
      .expect(404);

    const accounts = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/accounts")
      .expect(200);
    expect(accounts.body).toHaveLength(8);
    const bankAccount = accounts.body.find(
      ({ code }: { code: string }) => code === "572000",
    );
    const customerAccount = accounts.body.find(
      ({ code }: { code: string }) => code === "430000",
    );
    const manualInput = {
      entryDate: "2026-11-05",
      description: '=Manual; "bank" adjustment',
      lines: [
        { accountId: bankAccount.id, debit: 10 },
        { accountId: customerAccount.id, credit: 10 },
      ],
    };
    await authed(accountA.accessToken, tenantA)
      .post("/v1/accounting/journal-entries")
      .set("idempotency-key", "manual-unbalanced-a")
      .send({
        ...manualInput,
        lines: [
          { accountId: bankAccount.id, debit: 10 },
          { accountId: customerAccount.id, credit: 9 },
        ],
      })
      .expect(400);
    const manualEntry = await authed(accountA.accessToken, tenantA)
      .post("/v1/accounting/journal-entries")
      .set("idempotency-key", "manual-balanced-a")
      .send(manualInput)
      .expect(201);
    const retriedManual = await authed(accountA.accessToken, tenantA)
      .post("/v1/accounting/journal-entries")
      .set("idempotency-key", "manual-balanced-a")
      .send(manualInput)
      .expect(201);
    expect(retriedManual.body.id).toBe(manualEntry.body.id);
    const reversal = await authed(accountA.accessToken, tenantA)
      .post(`/v1/accounting/journal-entries/${manualEntry.body.id}/reverse`)
      .set("idempotency-key", "reverse-manual-a")
      .send({ entryDate: "2026-11-06", reason: "Acceptance test" })
      .expect(201);
    expect(reversal.body.reversalOfId).toBe(manualEntry.body.id);
    expect(accountingAmounts(reversal.body)).toEqual({
      "430000": { debit: "10", credit: "0" },
      "572000": { debit: "0", credit: "10" },
    });
    const journalReport = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/reports/journal?from=2026-01-01&to=2026-12-31")
      .expect(200);
    expect(journalReport.body).toMatchObject({
      from: "2026-01-01",
      to: "2026-12-31",
      totalDebit: "867",
      totalCredit: "867",
    });
    expect(journalReport.body.lines).toHaveLength(21);
    const paymentJournalReport = await authed(accountA.accessToken, tenantA)
      .get(
        "/v1/accounting/reports/journal?from=2026-09-01&to=2026-10-31&sourceType=PAYMENT",
      )
      .expect(200);
    expect(paymentJournalReport.body).toMatchObject({
      sourceType: "PAYMENT",
      totalDebit: "121",
      totalCredit: "121",
    });
    expect(paymentJournalReport.body.lines).toHaveLength(4);
    await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/reports/journal?from=2026-12-31&to=2026-01-01")
      .expect(400);
    await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/reports/journal?from=2025-01-01&to=2026-12-31")
      .expect(400);
    const journalCsv = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/reports/journal.csv?from=2026-01-01&to=2026-12-31")
      .expect("content-type", /text\/csv/)
      .expect(
        "content-disposition",
        'attachment; filename="journal-2026-01-01-2026-12-31.csv"',
      )
      .expect(200);
    expect(journalCsv.text).toContain(`"'=Manual; ""bank"" adjustment"`);
    const bankLedger = await authed(accountA.accessToken, tenantA)
      .get(
        `/v1/accounting/reports/general-ledger?accountId=${bankAccount.id}&from=2026-01-01&to=2026-12-31`,
      )
      .expect(200);
    expect(bankLedger.body).toMatchObject({
      account: { id: bankAccount.id, code: "572000" },
      openingBalance: "0",
      totalDebit: "131",
      totalCredit: "252",
      closingBalance: "-121",
    });
    expect(bankLedger.body.lines).toHaveLength(6);
    expect(bankLedger.body.lines.at(-1).runningBalance).toBe("-121");
    await authed(accountB.accessToken, tenantB)
      .get(
        `/v1/accounting/reports/general-ledger?accountId=${bankAccount.id}&from=2026-01-01&to=2026-12-31`,
      )
      .expect(404);
    const ledgerCsv = await authed(accountA.accessToken, tenantA)
      .get(
        `/v1/accounting/reports/general-ledger.csv?accountId=${bankAccount.id}&from=2026-01-01&to=2026-12-31`,
      )
      .expect("content-type", /text\/csv/)
      .expect(
        "content-disposition",
        'attachment; filename="general-ledger-572000-2026-01-01-2026-12-31.csv"',
      )
      .expect(200);
    expect(ledgerCsv.text).toContain(
      "TOTAL;;2026-12-31;Closing balance 572000;;131;252;-121",
    );
    const trialBalance = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/trial-balance?from=2026-01-01&to=2026-12-31")
      .expect(200);
    expect(
      trialBalance.body.reduce(
        (sum: number, row: { balance: string }) => sum + Number(row.balance),
        0,
      ),
    ).toBe(0);
    const fiscalYears = await authed(accountA.accessToken, tenantA)
      .get("/v1/accounting/fiscal-years")
      .expect(200);
    const lockedPaymentDraft = await authed(accountA.accessToken, tenantA)
      .post("/v1/invoices")
      .send(invoice(contactA.body.id))
      .expect(201);
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${lockedPaymentDraft.body.id}/issue`)
      .set("idempotency-key", "issue-locked-payment-a")
      .send({ sequenceId: sequence.body.id })
      .expect(200);
    const november = fiscalYears.body[0].periods.find(
      ({ code }: { code: string }) => code === "2026-11",
    );
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/accounting/periods/${november.id}/lock`)
      .expect(200);
    await authed(accountA.accessToken, tenantA)
      .post("/v1/accounting/journal-entries")
      .set("idempotency-key", "manual-locked-a")
      .send({ ...manualInput, entryDate: "2026-11-07" })
      .expect(409);
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/invoices/${lockedPaymentDraft.body.id}/payments`)
      .set("idempotency-key", "payment-locked-period-a")
      .send({
        amount: 121,
        paidAt: "2026-11-07T10:00:00.000Z",
        method: "BANK_TRANSFER",
      })
      .expect(409);
    const paymentRolledBack = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${lockedPaymentDraft.body.id}`)
      .expect(200);
    expect(paymentRolledBack.body).toMatchObject({
      status: "ISSUED",
      amountPaid: "0",
      amountDue: "121",
    });
    const rolledBackPayments = await authed(accountA.accessToken, tenantA)
      .get(`/v1/invoices/${lockedPaymentDraft.body.id}/payments`)
      .expect(200);
    expect(rolledBackPayments.body).toHaveLength(0);

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

    const defaultPurchaseApprovalPolicy = await authed(
      accountA.accessToken,
      tenantA,
    )
      .get("/v1/purchase-approval-policy")
      .expect(200);
    expect(defaultPurchaseApprovalPolicy.body).toEqual([
      { minimumAmount: "0", requiredApprovals: 1 },
    ]);
    await authed(accountA.accessToken, tenantA)
      .put("/v1/purchase-approval-policy")
      .send({
        tiers: [
          { minimumAmount: 0, requiredApprovals: 2 },
          { minimumAmount: 1000, requiredApprovals: 1 },
        ],
      })
      .expect(400);
    const twoLevelPolicy = await authed(accountA.accessToken, tenantA)
      .put("/v1/purchase-approval-policy")
      .send({ tiers: [{ minimumAmount: 0, requiredApprovals: 2 }] })
      .expect(200);
    expect(twoLevelPolicy.body[0]).toMatchObject({ requiredApprovals: 2 });
    const multiLevelDraft = await authed(accountA.accessToken, tenantA)
      .post("/v1/purchase-invoices")
      .send({
        ...purchaseInput,
        supplierInvoiceNumber: "PROV-2026-0050",
      })
      .expect(201);
    const firstApproval = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${multiLevelDraft.body.id}/approve`)
      .set("idempotency-key", "multi-approval-a-1")
      .send({ sequenceId: purchaseSequence.body.id })
      .expect(200);
    expect(firstApproval.body).toMatchObject({
      status: "PENDING_APPROVAL",
      requiredApprovals: 2,
      approvalCount: 1,
      receptionFullNumber: null,
    });
    expect(firstApproval.body.approvals).toHaveLength(1);
    await authed(accountA.accessToken, tenantA)
      .patch(`/v1/purchase-invoices/${multiLevelDraft.body.id}`)
      .send(purchaseInput)
      .expect(409);
    const ownerRole = await admin.role.findUniqueOrThrow({
      where: { code: "organization.owner" },
    });
    await admin.membership.create({
      data: {
        organizationId: tenantA.organizationId,
        companyId: tenantA.companyId,
        userId: tenantB.userId,
        roleId: ownerRole.id,
      },
    });
    const rejectedPurchase = await authed(accountB.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${multiLevelDraft.body.id}/reject`)
      .send({ reason: "Supplier evidence needs correction" })
      .expect(200);
    expect(rejectedPurchase.body).toMatchObject({
      status: "DRAFT",
      requiredApprovals: 1,
      approvalCount: 0,
    });
    expect(rejectedPurchase.body.approvals).toHaveLength(0);
    await authed(accountA.accessToken, tenantA)
      .patch(`/v1/purchase-invoices/${multiLevelDraft.body.id}`)
      .send({
        ...purchaseInput,
        supplierInvoiceNumber: "PROV-2026-0050",
        notes: "Evidence corrected",
      })
      .expect(200);
    const resubmittedPurchase = await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${multiLevelDraft.body.id}/approve`)
      .set("idempotency-key", "multi-approval-a-2")
      .send({ sequenceId: purchaseSequence.body.id })
      .expect(200);
    expect(resubmittedPurchase.body.status).toBe("PENDING_APPROVAL");
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${multiLevelDraft.body.id}/approve`)
      .set("idempotency-key", "multi-approval-a-2")
      .send({ sequenceId: purchaseSequence.body.id })
      .expect(200);
    await authed(accountA.accessToken, tenantA)
      .post(`/v1/purchase-invoices/${multiLevelDraft.body.id}/approve`)
      .set("idempotency-key", "multi-approval-a-3")
      .send({ sequenceId: purchaseSequence.body.id })
      .expect(409);
    const completedMultiLevelPurchase = await authed(
      accountB.accessToken,
      tenantA,
    )
      .post(`/v1/purchase-invoices/${multiLevelDraft.body.id}/approve`)
      .set("idempotency-key", "multi-approval-b-1")
      .send({ sequenceId: purchaseSequence.body.id })
      .expect(200);
    expect(completedMultiLevelPurchase.body).toMatchObject({
      status: "APPROVED",
      requiredApprovals: 2,
      approvalCount: 2,
      receptionFullNumber: "REC2026-00002",
    });
    expect(completedMultiLevelPurchase.body.approvals).toHaveLength(2);
    expect(
      new Set(
        completedMultiLevelPurchase.body.approvals.map(
          ({ approvedBy }: { approvedBy: { id: string } }) => approvedBy.id,
        ),
      ).size,
    ).toBe(2);
    await expect(
      admin.purchaseInvoiceApproval.update({
        where: { id: completedMultiLevelPurchase.body.approvals[0].id },
        data: { position: 2 },
      }),
    ).rejects.toThrow(/purchase approvals are immutable/);
    await expect(
      admin.$transaction(async (db) => {
        await db.purchaseInvoice.update({
          where: { id: multiLevelDraft.body.id },
          data: { requiredApprovals: 1, approvalCount: 1 },
        });
      }),
    ).rejects.toThrow(
      /purchase invoice approval count does not match its decisions/,
    );

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
      userId: membership.userId,
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

  function accountingAmounts(entry: {
    lines: Array<{
      account: { code: string };
      debit: string;
      credit: string;
    }>;
  }) {
    return Object.fromEntries(
      entry.lines.map((line) => [
        line.account.code,
        { debit: line.debit, credit: line.credit },
      ]),
    );
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
