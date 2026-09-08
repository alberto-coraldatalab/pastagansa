import { Injectable } from "@nestjs/common";
import PDFDocument = require("pdfkit");

interface DecimalValue {
  toString(): string;
}

export interface QuotePdfInput {
  company: {
    legalName: string;
    taxId: string;
  };
  quote: {
    code: string;
    status: string;
    issueDate: Date;
    validUntil: Date | null;
    currency: string;
    customerLegalName: string;
    customerTaxId: string | null;
    billingAddress: unknown;
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
  };
}

const PAGE = {
  left: 48,
  right: 547,
  top: 48,
  contentBottom: 742,
  footerY: 774,
};
const COLOR = {
  ink: "#172033",
  muted: "#667085",
  primary: "#175CD3",
  primarySoft: "#EFF4FF",
  line: "#D0D5DD",
  paper: "#FFFFFF",
};

@Injectable()
export class QuotePdfService {
  async render(input: QuotePdfInput): Promise<Buffer> {
    const { company, quote } = input;
    const document = new PDFDocument({
      size: "A4",
      margins: { top: PAGE.top, right: 48, bottom: 48, left: PAGE.left },
      bufferPages: true,
      info: {
        Title: `Presupuesto ${quote.code}`,
        Author: company.legalName,
        Subject: `Presupuesto para ${quote.customerLegalName}`,
        Creator: "Pastagansa",
      },
    });
    const chunks: Buffer[] = [];
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
    });

    this.drawDocumentHeader(document, input);
    this.drawCustomer(document, input);
    let rowY = this.drawTableHeader(document, document.y + 24);
    for (const line of quote.lines) {
      const rowHeight = Math.max(
        28,
        document.heightOfString(line.description, { width: 198 }) + 12,
      );
      if (rowY + rowHeight > PAGE.contentBottom) {
        document.addPage();
        this.drawContinuationHeader(document, quote.code);
        rowY = this.drawTableHeader(document, document.y + 16);
      }
      this.drawLine(document, line, quote.currency, rowY, rowHeight);
      rowY += rowHeight;
    }
    document.y = rowY + 20;
    this.ensureSpace(document, 150, quote.code);
    this.drawTotals(document, input);
    if (quote.notes) {
      const notesHeight =
        document.heightOfString(quote.notes, {
          width: PAGE.right - PAGE.left,
          lineGap: 2,
        }) + 38;
      this.ensureSpace(document, notesHeight, quote.code);
      const notesY = document.y + 14;
      document
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLOR.ink)
        .text("Notas", PAGE.left, notesY, { width: PAGE.right - PAGE.left });
      document
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR.muted)
        .text(quote.notes, PAGE.left, notesY + 18, {
          width: PAGE.right - PAGE.left,
          lineGap: 2,
        });
    }

    this.drawFooters(document, quote.code);
    document.end();
    return completed;
  }

  private drawDocumentHeader(
    document: PDFKit.PDFDocument,
    input: QuotePdfInput,
  ) {
    const { company, quote } = input;
    document.roundedRect(PAGE.left, PAGE.top, 42, 42, 8).fill(COLOR.primary);
    document
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(COLOR.paper)
      .text("PG", PAGE.left, PAGE.top + 12, { width: 42, align: "center" });
    document
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(COLOR.ink)
      .text(company.legalName, 104, PAGE.top + 3, { width: 245 });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text(`NIF: ${company.taxId}`, 104, PAGE.top + 25, { width: 245 });
    document
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor(COLOR.primary)
      .text("PRESUPUESTO", 360, PAGE.top, { width: 187, align: "right" });
    document
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLOR.ink)
      .text(quote.code, 360, PAGE.top + 28, { width: 187, align: "right" });
    document
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text(`Estado: ${quote.status}`, 360, PAGE.top + 45, {
        width: 187,
        align: "right",
      });
    document.y = 116;
  }

  private drawCustomer(document: PDFKit.PDFDocument, input: QuotePdfInput) {
    const { quote } = input;
    const top = document.y;
    document
      .roundedRect(PAGE.left, top, PAGE.right - PAGE.left, 105, 8)
      .fill(COLOR.primarySoft);
    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLOR.primary)
      .text("CLIENTE", PAGE.left + 14, top + 13);
    document
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLOR.ink)
      .text(quote.customerLegalName, PAGE.left + 14, top + 29, { width: 270 });
    const customerDetails = [
      quote.customerTaxId ? `NIF: ${quote.customerTaxId}` : null,
      ...billingAddressLines(quote.billingAddress),
    ].filter((value): value is string => Boolean(value));
    document
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLOR.muted)
      .text(
        customerDetails.join("\n") || "Sin dirección de facturación",
        PAGE.left + 14,
        top + 49,
        {
          width: 280,
          lineGap: 2,
        },
      );
    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text("FECHA", 382, top + 18, { width: 68 });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.ink)
      .text(formatDate(quote.issueDate), 455, top + 18, {
        width: 78,
        align: "right",
      });
    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text("VÁLIDO HASTA", 382, top + 43, { width: 78 });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.ink)
      .text(
        quote.validUntil ? formatDate(quote.validUntil) : "-",
        455,
        top + 43,
        {
          width: 78,
          align: "right",
        },
      );
    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text("MONEDA", 382, top + 68, { width: 68 });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.ink)
      .text(quote.currency, 455, top + 68, { width: 78, align: "right" });
    document.y = top + 105;
  }

  private drawContinuationHeader(document: PDFKit.PDFDocument, code: string) {
    document
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLOR.ink)
      .text(`Presupuesto ${code} - continuación`, PAGE.left, PAGE.top, {
        width: PAGE.right - PAGE.left,
      });
    document.y = 70;
  }

  private drawTableHeader(document: PDFKit.PDFDocument, y: number) {
    document.rect(PAGE.left, y, PAGE.right - PAGE.left, 24).fill(COLOR.ink);
    const headings = [
      ["Descripción", 58, 190, "left"],
      ["Cant.", 258, 45, "right"],
      ["Precio", 313, 60, "right"],
      ["Dto.", 383, 45, "right"],
      ["IVA", 438, 35, "right"],
      ["Total", 483, 54, "right"],
    ] as const;
    document.font("Helvetica-Bold").fontSize(7.5).fillColor(COLOR.paper);
    for (const [label, x, width, align] of headings)
      document.text(label, x, y + 8, { width, align });
    return y + 24;
  }

  private drawLine(
    document: PDFKit.PDFDocument,
    line: QuotePdfInput["quote"]["lines"][number],
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
      [formatDecimal(line.quantity, 3), 258, 45, "right"],
      [formatMoney(line.unitPrice, currency), 313, 60, "right"],
      [`${formatDecimal(line.discountPct, 2)}%`, 383, 45, "right"],
      [`${formatDecimal(line.taxRate, 2)}%`, 438, 35, "right"],
      [formatMoney(line.totalAmount, currency), 483, 54, "right"],
    ] as const;
    document.font("Helvetica").fontSize(7.5).fillColor(COLOR.ink);
    for (const [value, x, width, align] of cells)
      document.text(value, x, y + 7, { width, align, lineGap: 1 });
  }

  private drawTotals(document: PDFKit.PDFDocument, input: QuotePdfInput) {
    const { quote } = input;
    const x = 345;
    const width = PAGE.right - x;
    const rows = [
      ["Base", formatMoney(quote.subtotal, quote.currency)],
      ["Descuentos", `-${formatMoney(quote.discountTotal, quote.currency)}`],
      ["Impuestos", formatMoney(quote.taxTotal, quote.currency)],
    ];
    let y = document.y;
    document.fontSize(9);
    for (const [label, value] of rows) {
      document.font("Helvetica").fillColor(COLOR.muted).text(label, x, y, {
        width: 85,
      });
      document
        .font("Helvetica")
        .fillColor(COLOR.ink)
        .text(value, x + 85, y, {
          width: width - 85,
          align: "right",
        });
      y += 20;
    }
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
      .text("TOTAL", x, y + 12, { width: 85 });
    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(COLOR.primary)
      .text(formatMoney(quote.total, quote.currency), x + 85, y + 12, {
        width: width - 85,
        align: "right",
      });
    document.y = y + 38;
  }

  private ensureSpace(
    document: PDFKit.PDFDocument,
    requiredHeight: number,
    code: string,
  ) {
    if (document.y + requiredHeight <= PAGE.contentBottom) return;
    document.addPage();
    this.drawContinuationHeader(document, code);
  }

  private drawFooters(document: PDFKit.PDFDocument, code: string) {
    const range = document.bufferedPageRange();
    for (
      let index = range.start;
      index < range.start + range.count;
      index += 1
    ) {
      document.switchToPage(index);
      document
        .moveTo(PAGE.left, PAGE.footerY - 8)
        .lineTo(PAGE.right, PAGE.footerY - 8)
        .strokeColor(COLOR.line)
        .lineWidth(0.5)
        .stroke();
      document
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLOR.muted)
        .text(`Generado por Pastagansa · ${code}`, PAGE.left, PAGE.footerY, {
          width: 300,
          lineBreak: false,
        });
      document.text(
        `Página ${index + 1} de ${range.count}`,
        397,
        PAGE.footerY,
        {
          width: 150,
          align: "right",
          lineBreak: false,
        },
      );
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

function formatDecimal(value: DecimalValue, maximumFractionDigits: number) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value.toString()));
}

function formatMoney(value: DecimalValue, currency: string) {
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value.toString()))} ${currency}`;
}

function billingAddressLines(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const address = value as Record<string, unknown>;
  const string = (field: string) =>
    typeof address[field] === "string" && address[field]
      ? String(address[field])
      : null;
  return [
    string("line1"),
    string("line2"),
    [string("postalCode"), string("city")].filter(Boolean).join(" ") || null,
    [string("province"), string("country")].filter(Boolean).join(" · ") || null,
  ].filter((line): line is string => Boolean(line));
}
