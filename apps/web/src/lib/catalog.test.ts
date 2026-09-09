import { describe, expect, it } from "vitest";
import {
  catalogInputSchema,
  catalogPayload,
  formatMoney,
  taxLabel,
} from "./catalog";

describe("catalog helpers", () => {
  it("normalizes a service form", () => {
    const input = catalogPayload({
      type: "SERVICE",
      sku: "  CONS-01 ",
      name: "  Consultoría ",
      unit: "hour",
      salesPrice: "85.50",
      suggestedTaxCode: "ES_VAT_GENERAL_21",
      trackInventory: "on",
    });
    expect(catalogInputSchema.parse(input)).toMatchObject({
      type: "SERVICE",
      sku: "CONS-01",
      name: "Consultoría",
      salesPrice: 85.5,
      trackInventory: false,
    });
  });

  it("rejects negative prices", () => {
    expect(
      catalogInputSchema.safeParse({
        type: "PRODUCT",
        name: "Producto",
        salesPrice: -1,
        currency: "EUR",
        trackInventory: false,
      }).success,
    ).toBe(false);
  });

  it("formats prices and known tax suggestions for Spain", () => {
    expect(formatMoney("85.5", "EUR")).toContain("85,50");
    expect(taxLabel("ES_VAT_GENERAL_21")).toBe("IVA 21 %");
  });
});
