import { InvoicePdfService } from "./invoice-pdf.service";

describe("InvoicePdfService", () => {
  it("renders a valid multipage invoice", async () => {
    const service = new InvoicePdfService();
    const pdf = await service.render({
      fullNumber: "F2026-00001",
      status: "ISSUED",
      issuerLegalName: "Empresa Ejemplo, S.L.",
      issuerTaxId: "B12345674",
      customerLegalName: "Cliente Ejemplo, S.A.",
      customerTaxId: "A58818501",
      billingAddress: {
        line1: "Calle de Alcalá, 1",
        postalCode: "28014",
        city: "Madrid",
        country: "ES",
      },
      issueDate: new Date("2026-09-08"),
      dueDate: new Date("2026-10-08"),
      currency: "EUR",
      notes: "Pago mediante transferencia bancaria.",
      subtotal: value("9000"),
      discountTotal: value("900"),
      taxTotal: value("1701"),
      total: value("9801"),
      lines: Array.from({ length: 60 }, (_, index) => ({
        position: index + 1,
        description: `Servicio profesional ${index + 1} con descripción detallada`,
        quantity: value("1.5"),
        unitPrice: value("100"),
        discountPct: value("10"),
        taxRate: value("21"),
        totalAmount: value("163.35"),
      })),
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBe(4);
  });

  it("renders rectification metadata in a valid PDF", async () => {
    const service = new InvoicePdfService();
    const pdf = await service.render({
      fullNumber: "R2026-00001",
      status: "ISSUED",
      documentType: "CREDIT_NOTE",
      rectificationKind: "PARTIAL",
      rectificationImpact: "DECREASE",
      rectificationReason: "Correction of the billed quantity",
      originalInvoice: { id: "original", fullNumber: "F2026-00001" },
      issuerLegalName: "Example Company",
      issuerTaxId: "B12345674",
      customerLegalName: "Example Customer",
      customerTaxId: null,
      billingAddress: null,
      issueDate: new Date("2026-09-09"),
      dueDate: null,
      currency: "EUR",
      notes: null,
      subtotal: value("100"),
      discountTotal: value("0"),
      taxTotal: value("21"),
      total: value("121"),
      lines: [
        {
          position: 1,
          description: "Correction",
          quantity: value("1"),
          unitPrice: value("100"),
          discountPct: value("0"),
          taxRate: value("21"),
          totalAmount: value("121"),
        },
      ],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_500);
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBe(1);
  });
});

function value(input: string) {
  return { toString: () => input };
}
