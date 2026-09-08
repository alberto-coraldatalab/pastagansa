import { calculateInvoiceLine, formatInvoiceNumber } from "./invoices.service";

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

describe("formatInvoiceNumber", () => {
  it("pads short numbers without truncating larger values", () => {
    expect(formatInvoiceNumber("F2026", 42n, 5)).toBe("F2026-00042");
    expect(formatInvoiceNumber("F2026", 123456n, 5)).toBe("F2026-123456");
  });
});
