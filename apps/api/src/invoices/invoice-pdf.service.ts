import { Injectable } from "@nestjs/common";
import PDFDocument = require("pdfkit");

interface DecimalValue {
  toString(): string;
}

export interface InvoicePdfInput {
  fullNumber: string;
  status: string;
  documentType?: string;
  sifInvoiceType?: string;
  rectificationKind?: string | null;
  rectificationImpact?: string | null;
  rectificationReason?: string | null;
  originalInvoice?: { id: string; fullNumber: string | null } | null;
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
  ink: "#10233F",
  muted: "#52627A",
  primary: "#F71950",
  soft: "#FDECF1",
  line: "#D9DEE7",
  white: "#FFFFFF",
};

@Injectable()
export class InvoicePdfService {
  async render(invoice: InvoicePdfInput): Promise<Buffer> {
    const isRectification = invoice.documentType === "CREDIT_NOTE";
    const document = new PDFDocument({
      size: "A4",
      margins: { top: PAGE.top, right: 48, bottom: 48, left: PAGE.left },
      bufferPages: true,
      info: {
        Title: `${isRectification ? "Factura rectificativa" : "Factura"} ${invoice.fullNumber}`,
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
    if (isRectification) this.rectification(document, invoice);
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
    this.notesAndTerms(document, invoice);
    this.footers(document, invoice);
    document.end();
    return completed;
  }

  private header(document: PDFKit.PDFDocument, invoice: InvoicePdfInput) {
    const title =
      invoice.documentType === "CREDIT_NOTE"
        ? "FACTURA RECTIFICATIVA"
        : "FACTURA";
    document.circle(PAGE.left + 13, PAGE.top + 13, 11).fill(COLOR.primary);
    document.circle(PAGE.left + 15, PAGE.top + 10, 3).fill(COLOR.white);
    document
      .font("Helvetica-Bold")
      .fontSize(19)
      .fillColor(COLOR.ink)
      .text(invoice.issuerLegalName.toUpperCase(), PAGE.left + 34, PAGE.top + 5, {
        width: 300,
      });
    document
      .roundedRect(421, PAGE.top, 126, 30, 5)
      .fill(COLOR.soft);
    document
      .font("Helvetica-Bold")
      .fontSize(title.length > 12 ? 10 : 15)
      .fillColor(COLOR.primary)
      .text(title, 421, PAGE.top + 8, { width: 126, align: "center" });
    document.y = 106;
  }

  private rectification(
    document: PDFKit.PDFDocument,
    invoice: InvoicePdfInput,
  ) {
    const top = document.y + 12;
    const reason = invoice.rectificationReason ?? "-";
    const height = Math.max(
      62,
      document.heightOfString(reason, { width: 475, lineGap: 2 }) + 42,
    );
    document
      .roundedRect(PAGE.left, top, PAGE.right - PAGE.left, height, 8)
      .strokeColor(COLOR.primary)
      .lineWidth(1)
      .stroke();
    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLOR.primary)
      .text("RECTIFICA", PAGE.left + 14, top + 11);
    document
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLOR.ink)
      .text(
        invoice.originalInvoice?.fullNumber ?? "-",
        PAGE.left + 82,
        top + 10,
      )
      .text(
        `${invoice.sifInvoiceType ?? "R4"} · ${rectificationKind(invoice.rectificationKind)} · ${rectificationImpact(invoice.rectificationImpact)}`,
        345,
        top + 10,
        { width: 188, align: "right" },
      )
      .font("Helvetica-Bold")
      .text("Motivo", PAGE.left + 14, top + 30)
      .font("Helvetica")
      .fillColor(COLOR.muted)
      .text(reason, PAGE.left + 62, top + 30, { width: 471, lineGap: 2 });
    document.y = top + height;
  }

  private parties(document: PDFKit.PDFDocument, invoice: InvoicePdfInput) {
    const top = document.y;
    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(COLOR.primary)
      .text("Datos del emisor", PAGE.left, top);
    document
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLOR.ink)
      .text(invoice.issuerLegalName, PAGE.left, top + 19, { width: 275 });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text(`NIF: ${invoice.issuerTaxId}`, PAGE.left, top + 35);
    const rows = [
      ["Nº de factura", invoice.fullNumber],
      ["Fecha de emisión", formatDate(invoice.issueDate)],
      ["Fecha de vencimiento", invoice.dueDate ? formatDate(invoice.dueDate) : "-"],
    ];
    rows.forEach(([label, value], index) => {
      const y = top + index * 20;
      document
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR.ink)
        .text(label, 364, y, { width: 105 });
      document.text(value, 469, y, { width: 78, align: "right" });
    });
    const customerTop = top + 91;
    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(COLOR.primary)
      .text("Datos del cliente", PAGE.left, customerTop);
    document
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLOR.ink)
      .text(invoice.customerLegalName, PAGE.left, customerTop + 19, {
        width: 300,
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
        PAGE.left,
        customerTop + 36,
        {
          width: 330,
          lineGap: 2,
        },
      );
    document.y = top + 174;
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
    document
      .roundedRect(PAGE.left, y, PAGE.right - PAGE.left, 28, 5)
      .fill(COLOR.soft);
    const cells = [
      ["Descripción", 58, 190, "left"],
      ["Cant.", 258, 45, "right"],
      ["Precio", 313, 60, "right"],
      ["Dto.", 383, 45, "right"],
      ["IVA", 438, 35, "right"],
      ["Total", 483, 54, "right"],
    ] as const;
    document.font("Helvetica-Bold").fontSize(7.5).fillColor(COLOR.ink);
    cells.forEach(([label, x, width, align]) =>
      document.text(label.toUpperCase(), x, y + 10, { width, align }),
    );
    return y + 28;
  }

  private line(
    document: PDFKit.PDFDocument,
    line: InvoicePdfInput["lines"][number],
    currency: string,
    y: number,
    height: number,
  ) {
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
      ["Descuentos", discountMoney(invoice.discountTotal, invoice.currency)],
      ["IVA", money(invoice.taxTotal, invoice.currency)],
    ];
    rows.forEach(([label, value]) => {
      document
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR.ink)
        .text(label, x, y);
      document.fillColor(COLOR.ink).text(value, x + 82, y, {
        width: PAGE.right - x - 82,
        align: "right",
      });
      y += 20;
    });
    document.roundedRect(x - 10, y + 3, PAGE.right - x + 10, 34, 5).fill(COLOR.soft);
    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(COLOR.primary)
      .text("Total", x, y + 14);
    document
      .fillColor(COLOR.primary)
      .text(money(invoice.total, invoice.currency), x + 82, y + 14, {
        width: PAGE.right - x - 82,
        align: "right",
      });
    document.y = y + 48;
  }

  private notesAndTerms(
    document: PDFKit.PDFDocument,
    invoice: InvoicePdfInput,
  ) {
    this.ensureSpace(document, 105, invoice.fullNumber);
    const top = document.y + 18;
    document
      .moveTo(PAGE.left, top)
      .lineTo(PAGE.right, top)
      .strokeColor(COLOR.primary)
      .lineWidth(1)
      .stroke();
    document
      .moveTo(300, top + 20)
      .lineTo(300, top + 90)
      .strokeColor("#F68AA5")
      .lineWidth(0.7)
      .stroke();
    document
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLOR.primary)
      .text("NOTAS", PAGE.left, top + 22)
      .text("CONDICIONES DE PAGO", 318, top + 22);
    document
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLOR.muted)
      .text(invoice.notes || "Sin notas adicionales.", PAGE.left, top + 42, {
        width: 230,
        lineGap: 2,
      })
      .text(
        invoice.dueDate
          ? `Vencimiento: ${formatDate(invoice.dueDate)}\nMoneda: ${invoice.currency}`
          : `Vencimiento no especificado\nMoneda: ${invoice.currency}`,
        318,
        top + 42,
        { width: 229, lineGap: 2 },
      );
    document.y = top + 96;
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

  private footers(document: PDFKit.PDFDocument, invoice: InvoicePdfInput) {
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
        .text(`${invoice.issuerLegalName} | NIF: ${invoice.issuerTaxId}`, PAGE.left, PAGE.footer, {
          width: 300,
          lineBreak: false,
        });
      document.text(`Pastagansa · Página ${page + 1} de ${range.count}`, 347, PAGE.footer, {
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

function discountMoney(value: DecimalValue, currency: string) {
  const formatted = money(value, currency);
  return Number(value.toString()) === 0 ? formatted : `-${formatted}`;
}

function rectificationKind(value: string | null | undefined) {
  return (
    {
      TOTAL: "Total",
      PARTIAL: "Parcial",
      DIFFERENCE: "Por diferencias",
    }[value ?? ""] ?? "Rectificación"
  );
}

function rectificationImpact(value: string | null | undefined) {
  return value === "INCREASE" ? "Aumento" : "Disminución";
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
