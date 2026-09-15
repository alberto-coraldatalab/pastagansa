import { SifRecordType } from "@prisma/client";
import { formatSifIssueDate, hashSifRegistration } from "./sif-hash-v1";

export type SifChainRecord = {
  id: string;
  recordType: SifRecordType;
  chainPosition: bigint;
  issuerTaxId: string;
  invoiceNumber: string;
  invoiceIssueDate: Date;
  invoiceType: string;
  taxTotal: { toFixed(decimalPlaces: number): string };
  total: { toFixed(decimalPlaces: number): string };
  generatedAt: Date;
  previousRecordId: string | null;
  previousRecordHash: string | null;
  recordHash: string;
  payload: unknown;
};

export type SifChainVerification = {
  valid: boolean;
  recordsChecked: number;
  firstInvalid: { id: string; chainPosition: string; reason: string } | null;
};

export function verifySifChain(
  records: readonly SifChainRecord[],
): SifChainVerification {
  let previous: SifChainRecord | undefined;
  for (const [index, record] of records.entries()) {
    const invalid = (reason: string): SifChainVerification => ({
      valid: false,
      recordsChecked: index + 1,
      firstInvalid: {
        id: record.id,
        chainPosition: record.chainPosition.toString(),
        reason,
      },
    });
    if (record.recordType !== SifRecordType.REGISTRATION)
      return invalid("Unsupported SIF record type");
    if (record.chainPosition !== BigInt(index + 1))
      return invalid("Unexpected chain position");
    if (record.previousRecordId !== (previous?.id ?? null))
      return invalid("Previous record reference does not match");
    if (record.previousRecordHash !== (previous?.recordHash ?? null))
      return invalid("Previous record hash does not match");

    const input = readHashInput(record.payload);
    if (!input) return invalid("Stored hash input is invalid");
    if (
      input.issuerTaxId !== record.issuerTaxId ||
      input.invoiceNumber !== record.invoiceNumber ||
      input.issueDate !== formatSifIssueDate(record.invoiceIssueDate) ||
      input.invoiceType !== record.invoiceType ||
      input.taxTotal !== record.taxTotal.toFixed(2) ||
      input.total !== record.total.toFixed(2) ||
      input.previousHash !== (previous?.recordHash ?? "")
    )
      return invalid("Stored hash input does not match the record");
    if (hashSifRegistration(input) !== record.recordHash)
      return invalid("Record hash does not match the stored hash input");
    previous = record;
  }
  return { valid: true, recordsChecked: records.length, firstInvalid: null };
}

function readHashInput(value: unknown) {
  if (!isRecord(value) || !isRecord(value.hashInput)) return null;
  const input = value.hashInput;
  const fields = [
    "issuerTaxId",
    "invoiceNumber",
    "issueDate",
    "invoiceType",
    "taxTotal",
    "total",
    "previousHash",
    "generatedAt",
  ] as const;
  if (fields.some((field) => typeof input[field] !== "string")) return null;
  return {
    issuerTaxId: input.issuerTaxId as string,
    invoiceNumber: input.invoiceNumber as string,
    issueDate: input.issueDate as string,
    invoiceType: input.invoiceType as string,
    taxTotal: input.taxTotal as string,
    total: input.total as string,
    previousHash: input.previousHash as string,
    generatedAt: input.generatedAt as string,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
