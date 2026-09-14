import { describe, expect, it } from "vitest";
import {
  defaultQuoteExpiry,
  quoteCode,
  quoteInputSchema,
  quoteStatusLabel,
} from "./quotes";

describe("quotes", () => {
  it("validates a complete quote", () => {
    expect(
      quoteInputSchema.safeParse({
        contactId: "18127d12-8429-4b28-b24a-9c06b9785958",
        issueDate: "2026-09-14",
        validUntil: "2026-10-14",
        currency: "EUR",
        lines: [
          {
            description: "Consultoría",
            quantity: 2,
            unitPrice: 100,
            discountPct: 0,
            taxRate: 21,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects empty quotes and unsupported tax rates", () => {
    expect(
      quoteInputSchema.safeParse({
        contactId: "18127d12-8429-4b28-b24a-9c06b9785958",
        issueDate: "2026-09-14",
        currency: "EUR",
        lines: [],
      }).success,
    ).toBe(false);
    expect(
      quoteInputSchema.safeParse({
        contactId: "18127d12-8429-4b28-b24a-9c06b9785958",
        issueDate: "2026-09-14",
        currency: "EUR",
        lines: [
          { description: "Servicio", quantity: 1, unitPrice: 10, taxRate: 18 },
        ],
      }).success,
    ).toBe(false);
  });

  it("formats status, display code and default expiry", () => {
    expect(quoteStatusLabel("ACCEPTED")).toBe("Aceptado");
    expect(quoteCode("cmf1234567890")).toBe("PRE-34567890");
    expect(defaultQuoteExpiry("2026-01-15")).toBe("2026-02-14");
  });
});
