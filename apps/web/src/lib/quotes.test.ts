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
        sequenceId: "38127d12-8429-4b28-b24a-9c06b9785958",
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
    expect(quoteCode("cmf123456789012345678901234")).toBe("PRE-78901234");
    expect(quoteCode("P2026-0001")).toBe("P2026-0001");
    expect(defaultQuoteExpiry("2026-01-15")).toBe("2026-02-14");
  });
});
