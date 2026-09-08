import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { InvoicePdfService } from "../src/invoices/invoice-pdf.service";

async function main() {
  const output = resolve(
    process.argv[2] ?? "output/pdf/factura-rectificativa-ejemplo.pdf",
  );
  const pdf = await new InvoicePdfService().render({
    fullNumber: "R2026-00001",
    status: "EMITIDA",
    documentType: "CREDIT_NOTE",
    rectificationKind: "PARTIAL",
    rectificationImpact: "DECREASE",
    rectificationReason:
      "Corrección del número de horas facturadas en el servicio de consultoría.",
    originalInvoice: { id: "sample", fullNumber: "F2026-00001" },
    issuerLegalName: "Coral Data Lab, S.L.",
    issuerTaxId: "B12345674",
    customerLegalName: "Cliente Ejemplo, S.A.",
    customerTaxId: "A58818501",
    billingAddress: {
      line1: "Calle de Alcalá, 1",
      postalCode: "28014",
      city: "Madrid",
      province: "Madrid",
      country: "España",
    },
    issueDate: new Date("2026-09-09"),
    dueDate: null,
    currency: "EUR",
    notes: "Documento rectificativo vinculado a la factura indicada.",
    subtotal: value("240"),
    discountTotal: value("0"),
    taxTotal: value("50.40"),
    total: value("290.40"),
    lines: [
      {
        position: 1,
        description: "Ajuste de 2 horas de consultoría estratégica",
        quantity: value("2"),
        unitPrice: value("120"),
        discountPct: value("0"),
        taxRate: value("21"),
        totalAmount: value("290.40"),
      },
    ],
  });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, pdf);
  process.stdout.write(`${output}\n`);
}

function value(input: string) {
  return { toString: () => input };
}

void main();
