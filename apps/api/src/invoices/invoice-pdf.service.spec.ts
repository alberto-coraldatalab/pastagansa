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
});

function value(input: string) {
  return { toString: () => input };
}
