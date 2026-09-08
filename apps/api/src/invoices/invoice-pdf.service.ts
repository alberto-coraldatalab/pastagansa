import { Injectable } from "@nestjs/common";
import PDFDocument = require("pdfkit");

interface DecimalValue {
  toString(): string;
}

export interface InvoicePdfInput {
  fullNumber: string;
  status: string;
  issuerLegalName: string;
  issuerTaxId: string;
  customerLegalName: string;
  customerTaxId: string | null;
  billingAddress: unknown;
  issueDate: Date;
  dueDate: Date | null;
  currency: string;
  notes: string | null;
  subtotal: DecimalValue;
  discountTotal: DecimalValue;
  taxTotal: DecimalValue;
  total: DecimalValue;
  lines: Array<{
    position: number;
    description: string;
    quantity: DecimalValue;
    unitPrice: DecimalValue;
    discountPct: DecimalValue;
    taxRate: DecimalValue;
    totalAmount: DecimalValue;
  }>;
}

const PAGE = { left: 48, right: 547, top: 48, bottom: 742, footer: 774 };
const COLOR = {
  ink: "#172033",
  muted: "#667085",
  primary: "#0E7490",
  soft: "#ECFEFF",
  line: "#D0D5DD",
  white: "#FFFFFF",
};

@Injectable()
export class InvoicePdfService {
  async render(invoice: InvoicePdfInput): Promise<Buffer> {
    const document = new PDFDocument({
      size: "A4",
      margins: { top: PAGE.top, right: 48, bottom: 48, left: PAGE.left },
      bufferPages: true,
      info: {
        Title: `Factura ${invoice.fullNumber}`,
        Author: invoice.issuerLegalName,
        Subject: `Factura para ${invoice.customerLegalName}`,
        Creator: "Pastagansa",
      },
    });
    const chunks: Buffer[] = [];
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
    });

    this.header(document, invoice);
    this.parties(document, invoice);
    let y = this.tableHeader(document, document.y + 22);
    for (const line of invoice.lines) {
      const height = Math.max(
        28,
        document.heightOfString(line.description, { width: 190 }) + 12,
      );
      if (y + height > PAGE.bottom) {
        document.addPage();
        this.continuation(document, invoice.fullNumber);
        y = this.tableHeader(document, document.y + 16);
      }
      this.line(document, line, invoice.currency, y, height);
      y += height;
    }
    document.y = y + 20;
    this.ensureSpace(document, 145, invoice.fullNumber);
    this.totals(document, invoice);
    if (invoice.notes) {
      const height =
        document.heightOfString(invoice.notes, {
          width: PAGE.right - PAGE.left,
          lineGap: 2,
        }) + 38;
      this.ensureSpace(document, height, invoice.fullNumber);
      const notesY = document.y + 14;
      document
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLOR.ink)
        .text("Notas", PAGE.left, notesY);
      document
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR.muted)
        .text(invoice.notes, PAGE.left, notesY + 18, {
          width: PAGE.right - PAGE.left,
          lineGap: 2,
        });
    }
    this.footers(document, invoice.fullNumber);
    document.end();
    return completed;
  }

  private header(document: PDFKit.PDFDocument, invoice: InvoicePdfInput) {
    document.roundedRect(PAGE.left, PAGE.top, 42, 42, 8).fill(COLOR.primary);
    document
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(COLOR.white)
      .text("PG", PAGE.left, PAGE.top + 12, { width: 42, align: "center" });
    document
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(COLOR.ink)
      .text(invoice.issuerLegalName, 104, PAGE.top + 3, { width: 245 });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text(`NIF: ${invoice.issuerTaxId}`, 104, PAGE.top + 25);
    document
      .font("Helvetica-Bold")
      .fontSize(21)
      .fillColor(COLOR.primary)
      .text("FACTURA", 360, PAGE.top, { width: 187, align: "right" });
    document
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLOR.ink)
      .text(invoice.fullNumber, 360, PAGE.top + 29, {
        width: 187,
        align: "right",
      });
    document.y = 116;
  }

  private parties(document: PDFKit.PDFDocument, invoice: InvoicePdfInput) {
    const top = document.y;
    document
      .roundedRect(PAGE.left, top, PAGE.right - PAGE.left, 112, 8)
      .fill(COLOR.soft);
    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLOR.primary)
      .text("FACTURAR A", PAGE.left + 14, top + 13);
    document
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLOR.ink)
      .text(invoice.customerLegalName, PAGE.left + 14, top + 29, {
        width: 275,
      });
    const details = [
      invoice.customerTaxId ? `NIF: ${invoice.customerTaxId}` : null,
      ...addressLines(invoice.billingAddress),
    ].filter((value): value is string => Boolean(value));
    document
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLOR.muted)
      .text(
        details.join("\n") || "Sin dirección de facturación",
        62,
        top + 48,
        {
          width: 285,
          lineGap: 2,
        },
      );
    const rows = [
      ["EMISIÓN", formatDate(invoice.issueDate)],
      ["VENCIMIENTO", invoice.dueDate ? formatDate(invoice.dueDate) : "-"],
      ["MONEDA", invoice.currency],
      ["ESTADO", invoice.status],
    ];
    rows.forEach(([label, value], index) => {
      const y = top + 15 + index * 22;
      document
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor(COLOR.muted)
        .text(label, 370, y, { width: 85 });
      document
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLOR.ink)
        .text(value, 450, y, { width: 83, align: "right" });
    });
    document.y = top + 112;
  }

  private continuation(document: PDFKit.PDFDocument, number: string) {
    document
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLOR.ink)
      .text(`Factura ${number} · continuación`, PAGE.left, PAGE.top);
    document.y = 70;
  }

  private tableHeader(document: PDFKit.PDFDocument, y: number) {
    document.rect(PAGE.left, y, PAGE.right - PAGE.left, 24).fill(COLOR.ink);
    const cells = [
      ["Descripción", 58, 190, "left"],
      ["Cant.", 258, 45, "right"],
      ["Precio", 313, 60, "right"],
      ["Dto.", 383, 45, "right"],
      ["IVA", 438, 35, "right"],
      ["Total", 483, 54, "right"],
    ] as const;
    document.font("Helvetica-Bold").fontSize(7.5).fillColor(COLOR.white);
    cells.forEach(([label, x, width, align]) =>
      document.text(label, x, y + 8, { width, align }),
    );
    return y + 24;
  }

  private line(
    document: PDFKit.PDFDocument,
    line: InvoicePdfInput["lines"][number],
    currency: string,
    y: number,
    height: number,
  ) {
    if (line.position % 2 === 0)
      document
        .rect(PAGE.left, y, PAGE.right - PAGE.left, height)
        .fill("#F9FAFB");
    document
      .moveTo(PAGE.left, y + height)
      .lineTo(PAGE.right, y + height)
      .strokeColor(COLOR.line)
      .lineWidth(0.5)
      .stroke();
    const cells = [
      [line.description, 58, 190, "left"],
      [decimal(line.quantity, 3), 258, 45, "right"],
      [money(line.unitPrice, currency), 313, 60, "right"],
      [`${decimal(line.discountPct, 2)}%`, 383, 45, "right"],
      [`${decimal(line.taxRate, 2)}%`, 438, 35, "right"],
      [money(line.totalAmount, currency), 483, 54, "right"],
    ] as const;
    document.font("Helvetica").fontSize(7.5).fillColor(COLOR.ink);
    cells.forEach(([value, x, width, align]) =>
      document.text(value, x, y + 7, { width, align, lineGap: 1 }),
    );
  }

  private totals(document: PDFKit.PDFDocument, invoice: InvoicePdfInput) {
    const x = 345;
    let y = document.y;
    const rows = [
      ["Subtotal", money(invoice.subtotal, invoice.currency)],
      ["Descuentos", `-${money(invoice.discountTotal, invoice.currency)}`],
      ["IVA", money(invoice.taxTotal, invoice.currency)],
    ];
    rows.forEach(([label, value]) => {
      document
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR.muted)
        .text(label, x, y);
      document.fillColor(COLOR.ink).text(value, x + 82, y, {
        width: PAGE.right - x - 82,
        align: "right",
      });
      y += 20;
    });
    document
      .moveTo(x, y)
      .lineTo(PAGE.right, y)
      .strokeColor(COLOR.primary)
      .lineWidth(1.5)
      .stroke();
    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(COLOR.ink)
      .text("TOTAL", x, y + 12);
    document
      .fillColor(COLOR.primary)
      .text(money(invoice.total, invoice.currency), x + 82, y + 12, {
        width: PAGE.right - x - 82,
        align: "right",
      });
    document.y = y + 40;
  }

  private ensureSpace(
    document: PDFKit.PDFDocument,
    height: number,
    number: string,
  ) {
    if (document.y + height <= PAGE.bottom) return;
    document.addPage();
    this.continuation(document, number);
  }

  private footers(document: PDFKit.PDFDocument, number: string) {
    const range = document.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      document.switchToPage(page);
      document
        .moveTo(PAGE.left, PAGE.footer - 8)
        .lineTo(PAGE.right, PAGE.footer - 8)
        .strokeColor(COLOR.line)
        .lineWidth(0.5)
        .stroke();
      document
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLOR.muted)
        .text(`Generado por Pastagansa · ${number}`, PAGE.left, PAGE.footer, {
          width: 300,
          lineBreak: false,
        });
      document.text(`Página ${page + 1} de ${range.count}`, 397, PAGE.footer, {
        width: 150,
        align: "right",
        lineBreak: false,
      });
    }
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function decimal(value: DecimalValue, digits: number) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: digits,
  }).format(Number(value.toString()));
}

function money(value: DecimalValue, currency: string) {
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value.toString()))} ${currency}`;
}

function addressLines(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const address = value as Record<string, unknown>;
  const text = (field: string) =>
    typeof address[field] === "string" && address[field]
      ? String(address[field])
      : null;
  return [
    text("line1"),
    text("line2"),
    [text("postalCode"), text("city")].filter(Boolean).join(" ") || null,
    [text("province"), text("country")].filter(Boolean).join(" · ") || null,
  ].filter((line): line is string => Boolean(line));
}
