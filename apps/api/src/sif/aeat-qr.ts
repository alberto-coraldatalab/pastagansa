import QRCode = require("qrcode");

export type AeatQrMode = "VERIFACTU" | "NO_VERIFACTU";
export type AeatQrEnvironment = "TEST" | "PRODUCTION";

const endpoints: Record<AeatQrEnvironment, Record<AeatQrMode, string>> = {
  TEST: {
    VERIFACTU: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
    NO_VERIFACTU: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu",
  },
  PRODUCTION: {
    VERIFACTU: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
    NO_VERIFACTU: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu",
  },
};

export function aeatQrUrl(input: {
  issuerTaxId: string;
  invoiceNumber: string;
  issueDate: Date;
  total: string;
  mode: AeatQrMode;
  environment: AeatQrEnvironment;
}) {
  const nif = input.issuerTaxId.trim().toUpperCase();
  const number = input.invoiceNumber.trim();
  const amount = normalizedAmount(input.total);
  if (!/^[A-Z0-9]{9}$/.test(nif)) throw new Error("AEAT QR issuer NIF must have 9 characters");
  if (!number || number.length > 60 || /[^\x20-\x7e]/.test(number))
    throw new Error("AEAT QR invoice number must be printable ASCII and at most 60 characters");
  return `${endpoints[input.environment][input.mode]}?nif=${encodeURIComponent(nif)}&numserie=${encodeURIComponent(number)}&fecha=${formatDate(input.issueDate)}&importe=${amount}`;
}

export function aeatQrPng(url: string) {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

function formatDate(value: Date) {
  return `${String(value.getUTCDate()).padStart(2, "0")}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${value.getUTCFullYear()}`;
}

function normalizedAmount(value: string) {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) throw new Error("AEAT QR total must have up to 12 integer and 2 decimal digits");
  return value;
}
