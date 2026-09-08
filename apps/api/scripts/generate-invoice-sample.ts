import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { InvoicePdfService } from "../src/invoices/invoice-pdf.service";

async function main() {
  const output = resolve(process.argv[2] ?? "output/pdf/factura-ejemplo.pdf");
  const pdf = await new InvoicePdfService().render({
    fullNumber: "F2026-00001",
    status: "EMITIDA",
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
    issueDate: new Date("2026-09-08"),
    dueDate: new Date("2026-10-08"),
    currency: "EUR",
    notes:
      "Pago mediante transferencia bancaria indicando el número de factura.",
    subtotal: value("3200"),
    discountTotal: value("50"),
    taxTotal: value("661.50"),
    total: value("3811.50"),
    lines: [
      line(
        1,
        "Consultoría estratégica y diseño de arquitectura",
        "20",
        "120",
        "0",
        "21",
        "2904",
      ),
      line(
        2,
        "Implantación y configuración inicial",
        "1",
        "500",
        "10",
        "21",
        "544.50",
      ),
      line(
        3,
        "Formación del equipo y documentación",
        "3",
        "100",
        "0",
        "21",
        "363",
      ),
    ],
  });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, pdf);
  process.stdout.write(`${output}\n`);
}

function line(
  position: number,
  description: string,
  quantity: string,
  unitPrice: string,
  discountPct: string,
  taxRate: string,
  totalAmount: string,
) {
  return {
    position,
    description,
    quantity: value(quantity),
    unitPrice: value(unitPrice),
    discountPct: value(discountPct),
    taxRate: value(taxRate),
    totalAmount: value(totalAmount),
  };
}

function value(input: string) {
  return { toString: () => input };
}

void main();
