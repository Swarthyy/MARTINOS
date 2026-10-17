const UP_ORIGIN = "https://api.up.com.au";
const MAX_PAGES = 5;

type UpMoney = { currencyCode: string; valueInBaseUnits: number };
type UpAccount = {
  id: string;
  attributes: { displayName: string; accountType: string; balance: UpMoney };
};
type UpTransaction = {
  id: string;
  attributes: {
    status: string;
    description: string;
    createdAt: string;
    settledAt: string | null;
    amount: UpMoney;
  };
  relationships?: { account?: { data?: { id?: string } } };
};
type UpPage<T> = { data: T[]; links?: { next?: string | null } };

export type BankSnapshot = {
  source: "up_bank";
  fetchedAt: string;
  periodDays: number;
  accounts: Array<{ name: string; type: string; balanceMinor: number; currency: string }>;
  accountsTruncated: boolean;
  transactions: Array<{
    date: string;
    description: string;
    amountMinor: number;
    currency: string;
    status: string;
    accountName: string | null;
  }>;
  transactionsTruncated: boolean;
};

export class UpBankError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function validNextUrl(value: string, path: "/api/v1/accounts" | "/api/v1/transactions") {
  let url: URL;
  try { url = new URL(value); } catch { throw new UpBankError(502, "The bank returned an invalid pagination link."); }
  if (url.origin !== UP_ORIGIN || url.pathname !== path) throw new UpBankError(502, "The bank returned an unexpected pagination link.");
  return url.toString();
}

function money(value: UpMoney): { amountMinor: number; currency: string } {
  if (!value || !Number.isSafeInteger(value.valueInBaseUnits) || !/^[A-Z]{3}$/.test(value.currencyCode)) {
    throw new UpBankError(502, "The bank returned an unexpected amount format.");
  }
  return { amountMinor: value.valueInBaseUnits, currency: value.currencyCode };
}

async function pages<T>(
  path: "/api/v1/accounts" | "/api/v1/transactions",
  initialUrl: string,
  token: string,
  fetcher: typeof fetch
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let next: string | null = initialUrl;
  for (let count = 0; next && count < MAX_PAGES; count++) {
    const url = validNextUrl(next, path);
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000)
      });
    } catch { throw new UpBankError(503, "The bank could not be reached."); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new UpBankError(502, "The bank rejected its configured access token.");
      throw new UpBankError(503, "The bank request failed.");
    }
    let body: UpPage<T>;
    try { body = await response.json() as UpPage<T>; }
    catch { throw new UpBankError(502, "The bank returned invalid JSON."); }
    if (!Array.isArray(body.data)) throw new UpBankError(502, "The bank returned an unexpected response.");
    rows.push(...body.data);
    next = body.links?.next ?? null;
  }
  return { rows, truncated: next !== null };
}

export async function getUpBankSnapshot(
  token: string,
  periodDays = 30,
  fetcher: typeof fetch = fetch,
  now = new Date()
): Promise<BankSnapshot> {
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 90) throw new UpBankError(400, "Choose 1 to 90 days.");
  const since = new Date(now.getTime() - periodDays * 86_400_000).toISOString();
  const accountsUrl = `${UP_ORIGIN}/api/v1/accounts?page%5Bsize%5D=100`;
  const transactionsUrl = `${UP_ORIGIN}/api/v1/transactions?page%5Bsize%5D=100&filter%5Bsince%5D=${encodeURIComponent(since)}`;
  const [accountPage, transactionPage] = await Promise.all([
    pages<UpAccount>("/api/v1/accounts", accountsUrl, token, fetcher),
    pages<UpTransaction>("/api/v1/transactions", transactionsUrl, token, fetcher)
  ]);
  const accountNames = new Map<string, string>();
  const accounts = accountPage.rows.map((account) => {
    if (!account?.id || !account.attributes?.displayName) throw new UpBankError(502, "The bank returned an unexpected account.");
    accountNames.set(account.id, account.attributes.displayName);
    const balance = money(account.attributes.balance);
    return { name: account.attributes.displayName, type: account.attributes.accountType, balanceMinor: balance.amountMinor, currency: balance.currency };
  });
  const transactions = transactionPage.rows.map((transaction) => {
    if (!transaction?.attributes?.description || !transaction.attributes.createdAt) throw new UpBankError(502, "The bank returned an unexpected transaction.");
    const amount = money(transaction.attributes.amount);
    return {
      date: transaction.attributes.settledAt ?? transaction.attributes.createdAt,
      description: transaction.attributes.description,
      amountMinor: amount.amountMinor,
      currency: amount.currency,
      status: transaction.attributes.status,
      accountName: accountNames.get(transaction.relationships?.account?.data?.id ?? "") ?? null
    };
  });
  return {
    source: "up_bank",
    fetchedAt: now.toISOString(),
    periodDays,
    accounts,
    accountsTruncated: accountPage.truncated,
    transactions,
    transactionsTruncated: transactionPage.truncated
  };
}
