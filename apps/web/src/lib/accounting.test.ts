import { describe, expect, it } from "vitest";
import { accountingDescription, journalSourceLabel } from "./accounting";

describe("accounting presentation", () => {
  it("translates journal source types", () => {
    expect(journalSourceLabel("PAYMENT")).toBe("Cobro");
    expect(journalSourceLabel("PURCHASE_INVOICE")).toBe("Compra");
  });

  it("translates persisted descriptions without changing their reference", () => {
    expect(accountingDescription("Sales invoice F2026-0001")).toBe(
      "Factura de venta F2026-0001",
    );
    expect(accountingDescription("Purchase invoice 1")).toBe(
      "Factura de compra 1",
    );
    expect(accountingDescription("Customer receipt F2026-0001")).toBe(
      "Cobro de cliente F2026-0001",
    );
  });
});
