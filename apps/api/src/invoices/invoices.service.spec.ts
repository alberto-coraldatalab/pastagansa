import { calculateInvoiceLine } from "./invoices.service";

describe("calculateInvoiceLine", () => {
  it("calculates and rounds persisted invoice amounts deterministically", () => {
    const result = calculateInvoiceLine(
      {
        description: "Professional service",
        quantity: 1.5,
        unitPrice: 100,
        discountPct: 10,
        taxRate: 21,
      },
      1,
    );
    expect(result.persisted.netAmount.toFixed(2)).toBe("135.00");
    expect(result.persisted.taxAmount.toFixed(2)).toBe("28.35");
    expect(result.persisted.totalAmount.toFixed(2)).toBe("163.35");
  });
});
