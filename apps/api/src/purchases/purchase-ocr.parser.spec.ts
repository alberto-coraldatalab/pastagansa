import { extractPurchaseFields } from "./purchase-ocr.parser";

describe("purchase OCR field extraction", () => {
  it("normalizes common Spanish invoice fields and preserves evidence", () => {
    const result = extractPurchaseFields(
      [
        "PROVEEDOR: Servicios Ejemplo SL",
        "CIF: B12345678",
        "FACTURA Nº: F-2026/0042",
        "FECHA DE EMISIÓN: 09/09/2026",
        "BASE IMPONIBLE: 1.234,56 EUR",
        "IVA 21%: 259,26 EUR",
        "TOTAL FACTURA: 1.493,82 EUR",
        "VENCIMIENTO: 09/10/2026",
        "IBAN ES12 3456 7890 1234 5678 9012",
      ].join("\n"),
      87.456,
    );

    expect(result.supplierName?.value).toBe("Servicios Ejemplo SL");
    expect(result.taxId?.value).toBe("B12345678");
    expect(result.invoiceNumber?.value).toBe("F-2026/0042");
    expect(result.issueDate?.value).toBe("2026-09-09");
    expect(result.taxableBase?.value).toBe("1234.56");
    expect(result.taxAmount?.value).toBe("259.26");
    expect(result.total?.value).toBe("1493.82");
    expect(result.dueDate?.value).toBe("2026-10-09");
    expect(result.iban?.value).toBe("ES1234567890123456789012");
    expect(result.total).toMatchObject({
      confidence: 87.46,
      evidence: "TOTAL FACTURA: 1.493,82 EUR",
    });
  });

  it("does not invent absent fields and retains invalid dates for review", () => {
    const result = extractPurchaseFields(
      "FACTURA: X-9\nFECHA: 31/02/2026\nTOTAL: 10.00",
      120,
    );
    expect(result).not.toHaveProperty("taxId");
    expect(result.issueDate?.value).toBe("31/02/2026");
    expect(result.total?.confidence).toBe(100);
  });
});
