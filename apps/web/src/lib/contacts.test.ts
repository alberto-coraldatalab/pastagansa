import { describe, expect, it } from "vitest";
import { contactInputSchema, contactPayload } from "./contacts";

describe("contact input", () => {
  it("normalizes a browser form into an API customer", () => {
    const input = contactPayload({
      legalName: "  Cliente Demo SL ",
      tradeName: "",
      email: "facturas@example.com",
      paymentTermsDays: "30",
      paymentMethod: "BANK_TRANSFER",
      isSupplier: "on",
    });
    expect(contactInputSchema.parse(input)).toMatchObject({
      legalName: "Cliente Demo SL",
      tradeName: undefined,
      paymentTermsDays: 30,
      isCustomer: true,
      isSupplier: true,
    });
  });

  it("rejects invalid payment terms before reaching the API", () => {
    expect(
      contactInputSchema.safeParse({
        legalName: "Cliente",
        paymentTermsDays: 366,
        isCustomer: true,
        isSupplier: false,
      }).success,
    ).toBe(false);
  });
});
