import { z } from "zod";
import type { Account } from "./accounting";

export interface BankAccount {
  id: string;
  accountId: string;
  name: string;
  iban: string | null;
  currency: string;
  active: boolean;
  account: Account;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  externalId: string;
  bookingDate: string;
  valueDate: string | null;
  amount: string;
  currency: string;
  description: string;
  counterpartyName: string | null;
  reference: string | null;
  status: "UNMATCHED" | "RECONCILED";
  bankAccount: BankAccount;
  reconciliation: { id: string; journalLineId: string } | null;
}

export interface BankTransactionPage {
  data: BankTransaction[];
  nextCursor: string | null;
}

export interface ReconciliationSuggestion {
  journalLineId: string;
  score: number;
  account: { id: string; code: string };
  entry: {
    id: string;
    entryNumber: string;
    entryDate: string;
    description: string;
    sourceType: string;
    sourceId: string;
  };
  debit: string;
  credit: string;
}

export const bankAccountInputSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(1).max(240),
  iban: z.string().trim().max(34).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const bankImportInputSchema = z.object({
  bankAccountId: z.string().uuid(),
  transactions: z
    .array(
      z.object({
        externalId: z.string().trim().min(1).max(240),
        bookingDate: z.string().date(),
        amount: z
          .number()
          .finite()
          .refine((amount) => amount !== 0),
        description: z.string().trim().min(1).max(1000),
        counterpartyName: z.string().trim().max(240).optional(),
        reference: z.string().trim().max(240).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const reconcileInputSchema = z.object({
  journalLineId: z.string().uuid(),
});

export function maskedIban(iban: string | null) {
  if (!iban) return "Sin IBAN";
  return `${iban.slice(0, 4)} ···· ${iban.slice(-4)}`;
}
