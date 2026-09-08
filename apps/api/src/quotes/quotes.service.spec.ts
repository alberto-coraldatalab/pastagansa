import { calculateQuoteLine } from "./quotes.service";

describe("calculateQuoteLine", () => {
  it("persists only schema fields and rounds amounts deterministically", () => {
    const result = calculateQuoteLine(
      {
        description: "Service",
        quantity: 1.5,
        unitPrice: 100,
        discountPct: 10,
        taxRate: 21,
      },
      1,
    );
    expect(Object.keys(result.persisted)).not.toContain("gross");
    expect(result.persisted.netAmount.toFixed(2)).toBe("135.00");
    expect(result.persisted.taxAmount.toFixed(2)).toBe("28.35");
    expect(result.persisted.totalAmount.toFixed(2)).toBe("163.35");
  });
});
