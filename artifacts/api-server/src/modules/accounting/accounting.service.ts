import {
  createJournalEntry,
  createJournalEntryLines,
  ensureDefaultAccounts,
  getAccountsByCode,
  type DbTransaction,
} from "./accounting.repository.js";

const ACCOUNTING_ENABLED = process.env.ENABLE_ACCOUNTING === "true";

const DEFAULT_ACCOUNTS = {
  cash: "1000",
  accountsReceivable: "1200",
  revenue: "4000",
  feedExpense: "5000",
  medicineExpense: "5100",
} as const;

export interface JournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string | null;
}

function assertBalanced(lines: JournalLineInput[]) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (Math.round(debit * 100) !== Math.round(credit * 100)) {
    throw new Error(`Unbalanced journal entry: debit=${debit}, credit=${credit}`);
  }
}

export async function postJournalEntry(
  tx: DbTransaction,
  input: {
    date: string;
    description: string;
    sourceType: string;
    sourceId?: number | null;
    lines: JournalLineInput[];
  },
) {
  if (!ACCOUNTING_ENABLED) return null;
  assertBalanced(input.lines);
  await ensureDefaultAccounts(tx);
  const accounts = await getAccountsByCode(tx, input.lines.map(line => line.accountCode));
  const entry = await createJournalEntry(tx, {
    date: input.date,
    description: input.description,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    lines: [],
  });
  await createJournalEntryLines(tx, entry.id, input.lines.map(line => {
    const account = accounts.get(line.accountCode);
    if (!account) throw new Error(`Missing accounting account: ${line.accountCode}`);
    return {
      accountId: account.id,
      debit: Number(line.debit ?? 0),
      credit: Number(line.credit ?? 0),
      description: line.description ?? null,
    };
  }));
  return entry;
}

export async function postFeedPurchaseJournal(
  tx: DbTransaction,
  input: { date: string; amount: number; sourceId?: number | null; description?: string },
) {
  if (!ACCOUNTING_ENABLED) return null;
  return postJournalEntry(tx, {
    date: input.date,
    description: input.description ?? "Feed purchase",
    sourceType: "feed_purchase",
    sourceId: input.sourceId ?? null,
    lines: [
      { accountCode: DEFAULT_ACCOUNTS.feedExpense, debit: input.amount, credit: 0, description: "Feed expense" },
      { accountCode: DEFAULT_ACCOUNTS.cash, debit: 0, credit: input.amount, description: "Cash paid" },
    ],
  });
}

export async function postMedicinePurchaseJournal(
  tx: DbTransaction,
  input: { date: string; amount: number; sourceId?: number | null; description?: string },
) {
  if (!ACCOUNTING_ENABLED) return null;
  return postJournalEntry(tx, {
    date: input.date,
    description: input.description ?? "Medicine purchase",
    sourceType: "medicine_purchase",
    sourceId: input.sourceId ?? null,
    lines: [
      { accountCode: DEFAULT_ACCOUNTS.medicineExpense, debit: input.amount, credit: 0, description: "Medicine expense" },
      { accountCode: DEFAULT_ACCOUNTS.cash, debit: 0, credit: input.amount, description: "Cash paid" },
    ],
  });
}

export async function postChickSaleJournal(
  tx: DbTransaction,
  input: { date: string; amount: number; sourceId?: number | null; description?: string },
) {
  if (!ACCOUNTING_ENABLED) return null;
  return postJournalEntry(tx, {
    date: input.date,
    description: input.description ?? "Chick sale",
    sourceType: "chick_sale",
    sourceId: input.sourceId ?? null,
    lines: [
      { accountCode: DEFAULT_ACCOUNTS.cash, debit: input.amount, credit: 0, description: "Cash received" },
      { accountCode: DEFAULT_ACCOUNTS.revenue, debit: 0, credit: input.amount, description: "Sales revenue" },
    ],
  });
}

export async function postInvoicePaymentJournal(
  tx: DbTransaction,
  input: { date: string; amount: number; sourceId?: number | null; description?: string },
) {
  if (!ACCOUNTING_ENABLED) return null;
  return postJournalEntry(tx, {
    date: input.date,
    description: input.description ?? "Invoice payment",
    sourceType: "invoice_payment",
    sourceId: input.sourceId ?? null,
    lines: [
      { accountCode: DEFAULT_ACCOUNTS.cash, debit: input.amount, credit: 0, description: "Cash received" },
      { accountCode: DEFAULT_ACCOUNTS.accountsReceivable, debit: 0, credit: input.amount, description: "Receivable settled" },
    ],
  });
}
