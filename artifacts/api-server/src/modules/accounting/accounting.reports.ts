import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

interface AccountBalanceRow {
  account_id: number;
  code: string;
  name: string;
  type: AccountType;
  debit: string | number;
  credit: string | number;
}

interface SourceCashFlowRow {
  source_type: string;
  inflow: string | number;
  outflow: string | number;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function balanceFor(type: AccountType, debit: number, credit: number): number {
  if (type === "asset" || type === "expense") return roundMoney(debit - credit);
  return roundMoney(credit - debit);
}

async function getJournalIntegrity(from?: string, to?: string) {
  const totals = await db.execute(sql`
    SELECT
      COALESCE(SUM(jel.debit::numeric), 0)::float AS debit,
      COALESCE(SUM(jel.credit::numeric), 0)::float AS credit
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.status = 'posted'
      AND (${from ?? null}::date IS NULL OR je.entry_date::date >= ${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR je.entry_date::date <= ${to ?? null}::date)
  `);

  const imbalances = await db.execute(sql`
    SELECT
      je.id,
      je.source_type,
      COALESCE(SUM(jel.debit::numeric), 0)::float AS debit,
      COALESCE(SUM(jel.credit::numeric), 0)::float AS credit
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.status = 'posted'
      AND (${from ?? null}::date IS NULL OR je.entry_date::date >= ${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR je.entry_date::date <= ${to ?? null}::date)
    GROUP BY je.id, je.source_type
    HAVING ABS(COALESCE(SUM(jel.debit::numeric), 0) - COALESCE(SUM(jel.credit::numeric), 0)) > 0.005
    ORDER BY je.id
  `);

  const debit = roundMoney(toNumber((totals.rows[0] as any)?.debit));
  const credit = roundMoney(toNumber((totals.rows[0] as any)?.credit));

  return {
    totalDebits: debit,
    totalCredits: credit,
    balanced: Math.abs(debit - credit) < 0.01 && imbalances.rows.length === 0,
    imbalancedEntries: (imbalances.rows as any[]).map(row => ({
      id: Number(row.id),
      sourceType: String(row.source_type),
      debit: roundMoney(toNumber(row.debit)),
      credit: roundMoney(toNumber(row.credit)),
      delta: roundMoney(toNumber(row.debit) - toNumber(row.credit)),
    })),
  };
}

async function getAccountBalances(types: AccountType[], from?: string, to?: string) {
  const typeList = sql.join(types.map(type => sql`${type}`), sql`, `);
  const rows = await db.execute(sql`
    SELECT
      a.id AS account_id,
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(jel.debit::numeric), 0)::float AS debit,
      COALESCE(SUM(jel.credit::numeric), 0)::float AS credit
    FROM accounts a
    LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
    WHERE a.type IN (${typeList})
      AND (${from ?? null}::date IS NULL OR je.entry_date IS NULL OR je.entry_date::date >= ${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR je.entry_date IS NULL OR je.entry_date::date <= ${to ?? null}::date)
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `);

  return (rows.rows as unknown as AccountBalanceRow[]).map(row => {
    const debit = roundMoney(toNumber(row.debit));
    const credit = roundMoney(toNumber(row.credit));
    return {
      accountId: Number(row.account_id),
      code: row.code,
      name: row.name,
      type: row.type,
      debit,
      credit,
      balance: balanceFor(row.type, debit, credit),
    };
  });
}

export async function buildProfitAndLossReport(from?: string, to?: string) {
  const accounts = await getAccountBalances(["revenue", "expense"], from, to);
  const revenue = accounts.filter(account => account.type === "revenue");
  const expenses = accounts.filter(account => account.type === "expense");
  const totalRevenue = roundMoney(revenue.reduce((sum, account) => sum + account.balance, 0));
  const totalExpenses = roundMoney(expenses.reduce((sum, account) => sum + account.balance, 0));
  const netIncome = roundMoney(totalRevenue - totalExpenses);

  return {
    report: "profit_and_loss",
    period: { from: from ?? null, to: to ?? null },
    revenue,
    expenses,
    totals: {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netIncome,
    },
    integrity: await getJournalIntegrity(from, to),
  };
}

export async function buildBalanceSheetReport(asOf?: string) {
  const accounts = await getAccountBalances(["asset", "liability", "equity"], undefined, asOf);
  const profitAndLoss = await buildProfitAndLossReport(undefined, asOf);

  const assets = accounts.filter(account => account.type === "asset");
  const liabilities = accounts.filter(account => account.type === "liability");
  const equity = accounts.filter(account => account.type === "equity");

  const totalAssets = roundMoney(assets.reduce((sum, account) => sum + account.balance, 0));
  const totalLiabilities = roundMoney(liabilities.reduce((sum, account) => sum + account.balance, 0));
  const totalEquity = roundMoney(equity.reduce((sum, account) => sum + account.balance, 0));
  const currentEarnings = profitAndLoss.totals.netIncome;
  const liabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity + currentEarnings);

  return {
    report: "balance_sheet",
    asOf: asOf ?? null,
    assets,
    liabilities,
    equity: [
      ...equity,
      {
        accountId: null,
        code: "3999",
        name: "Current Earnings",
        type: "equity",
        debit: 0,
        credit: Math.max(currentEarnings, 0),
        balance: currentEarnings,
      },
    ],
    totals: {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: roundMoney(totalEquity + currentEarnings),
      liabilitiesAndEquity,
      balanced: Math.abs(totalAssets - liabilitiesAndEquity) < 0.01,
    },
    integrity: await getJournalIntegrity(undefined, asOf),
  };
}

export async function buildCashFlowReport(from?: string, to?: string) {
  const rows = await db.execute(sql`
    SELECT
      je.source_type,
      COALESCE(SUM(CASE WHEN jel.debit::numeric > jel.credit::numeric THEN jel.debit::numeric - jel.credit::numeric ELSE 0 END), 0)::float AS inflow,
      COALESCE(SUM(CASE WHEN jel.credit::numeric > jel.debit::numeric THEN jel.credit::numeric - jel.debit::numeric ELSE 0 END), 0)::float AS outflow
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.status = 'posted'
      AND a.code = '1000'
      AND (${from ?? null}::date IS NULL OR je.entry_date::date >= ${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR je.entry_date::date <= ${to ?? null}::date)
    GROUP BY je.source_type
    ORDER BY je.source_type
  `);

  const bySource = (rows.rows as unknown as SourceCashFlowRow[]).map(row => {
    const inflow = roundMoney(toNumber(row.inflow));
    const outflow = roundMoney(toNumber(row.outflow));
    return {
      sourceType: row.source_type,
      inflow,
      outflow,
      net: roundMoney(inflow - outflow),
    };
  });
  const totalInflows = roundMoney(bySource.reduce((sum, row) => sum + row.inflow, 0));
  const totalOutflows = roundMoney(bySource.reduce((sum, row) => sum + row.outflow, 0));

  return {
    report: "cash_flow",
    period: { from: from ?? null, to: to ?? null },
    operatingActivities: bySource,
    totals: {
      cashInflows: totalInflows,
      cashOutflows: totalOutflows,
      netCashFlow: roundMoney(totalInflows - totalOutflows),
    },
    integrity: await getJournalIntegrity(from, to),
  };
}
