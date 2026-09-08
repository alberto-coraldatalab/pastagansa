import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer = require("nodemailer");

export interface InvoiceMail {
  recipient: string;
  subject: string;
  invoiceNumber: string;
  issuerLegalName: string;
  filename: string;
  pdf: Buffer;
}

@Injectable()
export class SmtpInvoiceMailer {
  private readonly from: string | undefined;
  private readonly transport: nodemailer.Transporter | undefined;

  constructor(config: ConfigService) {
    const host = config.get<string>("SMTP_HOST");
    this.from = config.get<string>("SMTP_FROM");
    if (!host || !this.from) return;
    this.transport = nodemailer.createTransport({
      host,
      port: Number(config.get<string>("SMTP_PORT") ?? 587),
      secure: config.get<string>("SMTP_SECURE") === "true",
      auth: config.get<string>("SMTP_USER")
        ? {
            user: config.get<string>("SMTP_USER")!,
            pass: config.get<string>("SMTP_PASSWORD")!,
          }
        : undefined,
    });
  }

  get enabled() {
    return Boolean(this.transport && this.from);
  }

  async send(mail: InvoiceMail) {
    if (!this.transport || !this.from)
      throw new Error("SMTP transport is not configured");
    await this.transport.sendMail({
      from: this.from,
      to: mail.recipient,
      subject: mail.subject,
      text: `${mail.issuerLegalName} adjunta la factura ${mail.invoiceNumber}.`,
      html: `<p>${escapeHtml(mail.issuerLegalName)} adjunta la factura <strong>${escapeHtml(mail.invoiceNumber)}</strong>.</p>`,
      attachments: [
        {
          filename: mail.filename,
          content: mail.pdf,
          contentType: "application/pdf",
        },
      ],
    });
  }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}
