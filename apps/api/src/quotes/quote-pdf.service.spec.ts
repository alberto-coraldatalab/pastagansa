import { QuotePdfService } from "./quote-pdf.service";

describe("QuotePdfService", () => {
  it("renders a valid multipage quotation with stable metadata", async () => {
    const service = new QuotePdfService();
    const lines = Array.from({ length: 60 }, (_, index) => ({
      position: index + 1,
      description: `Servicio profesional ${index + 1} con una descripción suficientemente larga para comprobar el ajuste de línea`,
      quantity: decimal("1.5"),
      unitPrice: decimal("100"),
      discountPct: decimal("10"),
      taxRate: decimal("21"),
      totalAmount: decimal("163.35"),
    }));
    const pdf = await service.render({
      company: { legalName: "Empresa Ejemplo, S.L.", taxId: "B12345674" },
      quote: {
        code: "PRE-2026-0001",
        status: "DRAFT",
        issueDate: new Date("2026-09-08"),
        validUntil: new Date("2026-10-08"),
        currency: "EUR",
        customerLegalName: "Cliente Ejemplo, S.A.",
        customerTaxId: "A58818501",
        billingAddress: {
          line1: "Calle de Alcalá, 1",
          postalCode: "28014",
          city: "Madrid",
          country: "ES",
        },
        notes: "Oferta válida durante el periodo indicado.",
        subtotal: decimal("9000"),
        discountTotal: decimal("900"),
        taxTotal: decimal("1701"),
        total: decimal("9801"),
        lines,
      },
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBe(4);
  });
});

function decimal(value: string) {
  return { toString: () => value };
}
