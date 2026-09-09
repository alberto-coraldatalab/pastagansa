import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
  it("summarizes only the active tenant results returned by Prisma", async () => {
    const invoice = {
      count: jest.fn().mockResolvedValue(3),
      aggregate: jest.fn().mockResolvedValue({
        _count: 2,
        _sum: { amountDue: { toString: () => "242" } },
      }),
    };
    const purchaseInvoice = {
      count: jest.fn().mockResolvedValue(4),
      aggregate: jest.fn().mockResolvedValue({
        _count: 1,
        _sum: { amountDue: { toString: () => "60.50" } },
      }),
    };
    const service = new DashboardService({
      required: {
        organizationId: "organization-id",
        companyId: "company-id",
      },
      db: { invoice, purchaseInvoice },
    } as never);

    await expect(service.summary()).resolves.toEqual({
      currency: "EUR",
      sales: { count: 3 },
      purchases: { count: 4 },
      receivable: { count: 2, amount: "242" },
      payable: { count: 1, amount: "60.50" },
    });
    expect(invoice.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "organization-id",
          companyId: "company-id",
        }),
      }),
    );
    expect(purchaseInvoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "organization-id",
          companyId: "company-id",
        }),
      }),
    );
  });
});
