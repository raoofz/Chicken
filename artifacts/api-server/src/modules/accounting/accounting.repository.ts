import { db, accountsTable, journalEntriesTable, journalEntryLinesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type AccountingTx = DbTransaction;

export interface AccountSeed {
  code: string;
  name: string;
  type: typeof accountsTable.$inferSelect.type;
}

export interface JournalLineInput {
  accountId: number;
  debit?: number;
  credit?: number;
  memo?: string | null;
}

export interface JournalEntryInput {
  date: string;
  sourceType: string;
  sourceId?: number | null;
  description: string;
  metadata?: unknown;
  lines: Array<{
    accountCode: string;
    debit?: number;
    credit?: number;
    description?: string | null;
  }>;
}

const DEFAULT_ACCOUNTS: AccountSeed[] = [
  { code: "1000", name: "Cash", type: "asset" },
  { code: "1200", name: "Accounts Receivable", type: "asset" },
  { code: "1300", name: "Inventory", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "3000", name: "Owner Equity", type: "equity" },
  { code: "4000", name: "Sales Revenue", type: "revenue" },
  { code: "5000", name: "Feed Expense", type: "expense" },
  { code: "5100", name: "Medicine Expense", type: "expense" },
  { code: "5200", name: "General Farm Expense", type: "expense" },
];

function normalBalanceFor(type: AccountSeed["type"]): typeof accountsTable.$inferSelect.normalBalance {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

export async function ensureAccount(tx: DbTransaction, account: AccountSeed): Promise<number> {
  const [existing] = await tx
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(eq(accountsTable.code, account.code))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx.insert(accountsTable).values({
    ...account,
    normalBalance: normalBalanceFor(account.type),
  }).returning({ id: accountsTable.id });
  return created.id;
}

export async function ensureDefaultAccounts(tx: DbTransaction) {
  for (const account of DEFAULT_ACCOUNTS) {
    await ensureAccount(tx, account);
  }
}

export async function getAccountsByCode(tx: DbTransaction, codes: string[]) {
  const rows = await tx.select().from(accountsTable);
  return new Map(rows.filter(row => codes.includes(row.code)).map(row => [row.code, row]));
}

export async function createJournalEntry(tx: DbTransaction, input: JournalEntryInput) {
  const [entry] = await tx.insert(journalEntriesTable).values({
    entryDate: new Date(`${input.date}T00:00:00.000Z`),
    memo: input.description,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    metadata: input.metadata ?? null,
  }).returning();
  return entry;
}

export const insertJournalEntry = createJournalEntry;

export async function createJournalEntryLines(
  tx: DbTransaction,
  entryId: number,
  lines: Array<{
    accountId: number;
    debit: number;
    credit: number;
    description?: string | null;
  }>,
) {
  await tx.insert(journalEntryLinesTable).values(lines.map(line => ({
    journalEntryId: entryId,
    accountId: line.accountId,
    debit: String(line.debit),
    credit: String(line.credit),
    description: line.description ?? null,
  })));
}

export async function insertJournalEntryLine(
  tx: DbTransaction,
  journalEntryId: number,
  line: JournalLineInput,
) {
  await tx.insert(journalEntryLinesTable).values({
    journalEntryId,
    accountId: line.accountId,
    debit: String(line.debit ?? 0),
    credit: String(line.credit ?? 0),
    description: line.memo ?? null,
  });
}

export async function withAccountingTransaction<T>(fn: (tx: DbTransaction) => Promise<T>) {
  return db.transaction(fn);
}
