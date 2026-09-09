import { describe, expect, it } from "vitest";
import {
  bankAccountInputSchema,
  bankImportInputSchema,
  maskedIban,
  reconcileInputSchema,
} from "./banking";

describe("banking helpers", () => {
  it("validates bank setup and normalized imports", () => {
    expect(
      bankAccountInputSchema.parse({
        accountId: "11111111-1111-4111-8111-111111111111",
        name: " Cuenta operativa ",
        iban: "ES91 2100 0418 4502 0005 1332",
        currency: "EUR",
      }).name,
    ).toBe("Cuenta operativa");
    expect(
      bankImportInputSchema.safeParse({
        bankAccountId: "11111111-1111-4111-8111-111111111111",
        transactions: [
          {
            externalId: "MOV-1",
            bookingDate: "2026-09-09",
            amount: -121,
            description: "Pago proveedor",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects zero movements and invalid reconciliation identifiers", () => {
    expect(
      bankImportInputSchema.safeParse({
        bankAccountId: "11111111-1111-4111-8111-111111111111",
        transactions: [
          {
            externalId: "MOV-1",
            bookingDate: "2026-09-09",
            amount: 0,
            description: "Movimiento inválido",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      reconcileInputSchema.safeParse({ journalLineId: "no" }).success,
    ).toBe(false);
  });

  it("masks the middle of an IBAN", () => {
    expect(maskedIban("ES9121000418450200051332")).toBe("ES91 ···· 1332");
    expect(maskedIban(null)).toBe("Sin IBAN");
  });
});
