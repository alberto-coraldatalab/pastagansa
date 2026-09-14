export interface Account {
  id: string;
  code: string;
  name: string;
  accountClass: string;
  isReconcilable: boolean;
  active: boolean;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  sourceType: string;
  description: string;
  lines: Array<{
    id: string;
    debit: string;
    credit: string;
    account: Account;
  }>;
}

export interface JournalPage {
  data: JournalEntry[];
  nextCursor: string | null;
}

export interface GeneralLedger {
  account: Account;
  from: string;
  to: string;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  lines: Array<{
    id: string;
    entryNumber: string;
    entryDate: string;
    description: string;
    debit: string;
    credit: string;
    runningBalance: string;
  }>;
}

export function journalSourceLabel(source: string) {
  return (
    (
      {
        SALES_INVOICE: "Venta",
        PURCHASE_INVOICE: "Compra",
        PAYMENT: "Cobro",
        CUSTOMER_PAYMENT: "Cobro",
        SUPPLIER_PAYMENT: "Pago",
        MANUAL: "Manual",
        REVERSAL: "Reversión",
      } as Record<string, string>
    )[source] ?? source
  );
}

export function accountingDescription(description: string) {
  const translations: Array<[RegExp, string]> = [
    [/^Sales invoice\b/i, "Factura de venta"],
    [/^Purchase invoice\b/i, "Factura de compra"],
    [/^Customer receipt\b/i, "Cobro de cliente"],
    [/^Supplier payment\b/i, "Pago a proveedor"],
    [/^Reversal:\s*/i, "Reversión: "],
  ];
  for (const [pattern, replacement] of translations)
    if (pattern.test(description))
      return description.replace(pattern, replacement);
  return description;
}
