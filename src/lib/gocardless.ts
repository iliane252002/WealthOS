// GoCardless Bank Data API v2 (formerly Nordigen)
// Docs: https://developer.gocardless.com/bank-account-data/overview

const GC_BASE = "https://bankaccountdata.gocardless.com/api/v2";

let cachedToken: { access: string; expiresAt: number } | null = null;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.access;
  }

  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY must be set");
  }

  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GoCardless auth failed: ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    access: data.access,
    expiresAt: Date.now() + data.access_expires * 1000,
  };

  return cachedToken.access;
}

async function gcFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${GC_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GoCardless API error ${res.status}: ${err}`);
  }

  return res.json();
}

// ─── Institutions ──────────────────────────────────────────────────────────────

export interface Institution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo: string;
}

export async function listInstitutions(country = "FR"): Promise<Institution[]> {
  return gcFetch(`/institutions/?country=${country}`);
}

// ─── Requisitions (OAuth flow) ────────────────────────────────────────────────

export interface Requisition {
  id: string;
  status: string;
  accounts: string[];
  link: string;
  institution_id: string;
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string
): Promise<Requisition> {
  return gcFetch("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      reference,
      user_language: "FR",
    }),
  });
}

export async function getRequisition(requisitionId: string): Promise<Requisition> {
  return gcFetch(`/requisitions/${requisitionId}/`);
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface GCTransaction {
  transactionId: string;
  bookingDate: string;
  transactionAmount: { amount: string; currency: string };
  debtorName?: string;
  creditorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
}

export interface GCTransactionsResponse {
  transactions: {
    booked: GCTransaction[];
    pending: GCTransaction[];
  };
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string
): Promise<GCTransaction[]> {
  const params = dateFrom ? `?date_from=${dateFrom}` : "";
  const data: GCTransactionsResponse = await gcFetch(`/accounts/${accountId}/transactions/${params}`);
  return data.transactions.booked;
}

// ─── Matching logic ───────────────────────────────────────────────────────────

export interface MatchCandidate {
  transactionId: string;
  rentEventId: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

export function matchTransactionToRentEvent(
  tx: GCTransaction,
  rentEvents: Array<{
    id: string;
    amount: number;
    dueDate: string;
    lease: {
      tenant: { firstName: string; lastName: string };
      lot: { label: string; property: { name: string } };
    };
  }>
): { rentEventId: string; confidence: "HIGH" | "MEDIUM" | "LOW" } | null {
  const txAmount = Math.abs(parseFloat(tx.transactionAmount.amount));
  const txDate = new Date(tx.bookingDate);
  const ref = [
    tx.remittanceInformationUnstructured,
    tx.remittanceInformationStructured,
    tx.debtorName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const event of rentEvents) {
    if (event.amount !== txAmount) continue; // Amount must match exactly

    const tenantName = `${event.lease.tenant.firstName} ${event.lease.tenant.lastName}`.toLowerCase();
    const firstName = event.lease.tenant.firstName.toLowerCase();
    const lastName = event.lease.tenant.lastName.toLowerCase();
    const dueDate = new Date(event.dueDate);
    const daysDiff = Math.abs((txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // HIGH: name matches in reference + within 15 days of due date
    if ((ref.includes(firstName) || ref.includes(lastName)) && daysDiff <= 15) {
      return { rentEventId: event.id, confidence: "HIGH" };
    }

    // MEDIUM: name matches but further from due date, OR amount+date but no name
    if (ref.includes(firstName) || ref.includes(lastName)) {
      return { rentEventId: event.id, confidence: "MEDIUM" };
    }

    if (daysDiff <= 5) {
      return { rentEventId: event.id, confidence: "MEDIUM" };
    }
  }

  return null;
}
