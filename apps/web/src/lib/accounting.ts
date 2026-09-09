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
