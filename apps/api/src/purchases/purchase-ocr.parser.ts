export interface OcrFieldSuggestion {
  value: string;
  confidence: number;
  evidence: string;
}

export type PurchaseOcrFields = Partial<
  Record<
    | "supplierName"
    | "taxId"
    | "invoiceNumber"
    | "issueDate"
    | "taxableBase"
    | "taxAmount"
    | "total"
    | "dueDate"
    | "iban",
    OcrFieldSuggestion
  >
>;

export function extractPurchaseFields(
  rawText: string,
  overallConfidence: number,
): PurchaseOcrFields {
  const text = rawText.replace(/\r/g, "");
  const confidence = clampConfidence(overallConfidence);
  const fields: PurchaseOcrFields = {};
  match(
    fields,
    "taxId",
    text,
    /\b(?:NIF|CIF)\s*[:#-]?\s*([A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z])\b/i,
    confidence,
  );
  match(
    fields,
    "invoiceNumber",
    text,
    /(?:FACTURA|N[ÚU]M(?:ERO)?\.?)[ \t]*(?:N[ºO]\.?|#)?[ \t]*[:#-]?[ \t]*([A-Z0-9][A-Z0-9./_-]{2,})/i,
    confidence,
  );
  matchDate(
    fields,
    "issueDate",
    text,
    /(?:FECHA(?: DE EMISI[ÓO]N)?)[ \t]*:?[ \t]*(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})/i,
    confidence,
  );
  matchDate(
    fields,
    "dueDate",
    text,
    /(?:VENCIMIENTO|FECHA DE VENCIMIENTO)[ \t]*:?[ \t]*(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})/i,
    confidence,
  );
  matchAmount(
    fields,
    "taxableBase",
    text,
    /BASE(?: IMPONIBLE)?[ \t]*:?[ \t]*([\d.,]+)[ \t]*(?:€|EUR)?/i,
    confidence,
  );
  matchAmount(
    fields,
    "taxAmount",
    text,
    /(?:CUOTA IVA|IVA(?: [\d.,]+\s*%)?)[ \t]*:?[ \t]*([\d.,]+)[ \t]*(?:€|EUR)?/i,
    confidence,
  );
  matchAmount(
    fields,
    "total",
    text,
    /TOTAL(?: FACTURA)?[ \t]*:?[ \t]*([\d.,]+)[ \t]*(?:€|EUR)?/i,
    confidence,
  );
  match(
    fields,
    "iban",
    text,
    /\b(ES\d{2}(?:[ \t]?\d{4}){5})\b/i,
    confidence,
    (value) => value.replace(/\s/g, "").toUpperCase(),
  );
  match(
    fields,
    "supplierName",
    text,
    /(?:PROVEEDOR|EMISOR)[ \t]*:?[ \t]*([^\n]{2,240})/i,
    confidence,
    (value) => value.trim(),
  );
  return fields;
}

function match(
  fields: PurchaseOcrFields,
  key: keyof PurchaseOcrFields,
  text: string,
  pattern: RegExp,
  confidence: number,
  normalize: (value: string) => string = (value) => value.trim(),
) {
  const result = pattern.exec(text);
  if (!result) return;
  fields[key] = {
    value: normalize(result[1]),
    confidence,
    evidence: result[0].trim().slice(0, 300),
  };
}

function matchAmount(
  fields: PurchaseOcrFields,
  key: keyof PurchaseOcrFields,
  text: string,
  pattern: RegExp,
  confidence: number,
) {
  match(fields, key, text, pattern, confidence, normalizeAmount);
}

function matchDate(
  fields: PurchaseOcrFields,
  key: keyof PurchaseOcrFields,
  text: string,
  pattern: RegExp,
  confidence: number,
) {
  match(fields, key, text, pattern, confidence, normalizeDate);
}

function normalizeAmount(value: string) {
  const compact = value.replace(/\s/g, "");
  const decimalSeparator = Math.max(
    compact.lastIndexOf(","),
    compact.lastIndexOf("."),
  );
  if (decimalSeparator < 0) return compact;
  const integer = compact.slice(0, decimalSeparator).replace(/[.,]/g, "");
  const decimal = compact.slice(decimalSeparator + 1);
  return `${integer || "0"}.${decimal.padEnd(2, "0").slice(0, 2)}`;
}

function normalizeDate(value: string) {
  const parts = value.split(/[/-]/).map(Number);
  const [year, month, day] =
    parts[0] > 999 ? parts : [parts[2], parts[1], parts[0]];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return value;
  return date.toISOString().slice(0, 10);
}

function clampConfidence(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}
