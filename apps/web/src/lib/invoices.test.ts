import { describe, expect, it } from "vitest";
import {
  formatInvoiceDate,
  invoiceInputSchema,
  invoiceStatusLabel,
  todayIso,
} from "./invoices";

const valid = {
  contactId: "0198f8c0-60d6-74a4-9247-bd28e31502ef",
  issueDate: "2026-09-09",
  dueDate: "",
  currency: "EUR" as const,
  notes: "Gracias",
  lines: [
    { description: "Consultoría", quantity: 2, unitPrice: 50, taxRate: 21 },
  ],
};

describe("invoice input", () => {
  it("accepts a usable draft", () => {
    expect(invoiceInputSchema.safeParse(valid).success).toBe(true);
  });

  it("requires at least one valid line", () => {
    expect(invoiceInputSchema.safeParse({ ...valid, lines: [] }).success).toBe(
      false,
    );
    expect(
      invoiceInputSchema.safeParse({
        ...valid,
        lines: [{ ...valid.lines[0], taxRate: 7 }],
      }).success,
    ).toBe(false);
  });
});

describe("invoice presentation", () => {
  it("uses local calendar dates for defaults", () => {
    expect(todayIso(new Date(2026, 8, 9, 23, 30))).toBe("2026-09-09");
  });

  it("translates statuses and formats API dates", () => {
    expect(invoiceStatusLabel("DRAFT")).toBe("Borrador");
    expect(formatInvoiceDate("2026-09-09T00:00:00.000Z")).toBe("9/9/2026");
  });
});
