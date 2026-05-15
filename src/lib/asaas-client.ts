/**
 * Asaas API Client — server-side only.
 * NUNCA importar no client-side.
 */

const BASE_URL = process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3";
const API_KEY = process.env.ASAAS_API_KEY || "";

interface AsaasError {
  errors: { code: string; description: string }[];
}

class AsaasApiError extends Error {
  status: number;
  errors: { code: string; description: string }[];
  constructor(status: number, errors: AsaasError["errors"]) {
    super(errors.map((e) => e.description).join("; "));
    this.name = "AsaasApiError";
    this.status = status;
    this.errors = errors;
  }
}

// Rate limit: 50ms delay between batch calls
let lastCallTime = 0;
async function rateLimitDelay() {
  const now = Date.now();
  const diff = now - lastCallTime;
  if (diff < 50) await new Promise((r) => setTimeout(r, 50 - diff));
  lastCallTime = Date.now();
}

async function asaasFetch(path: string, opts: RequestInit = {}): Promise<any> {
  await rateLimitDelay();
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      access_token: API_KEY,
      ...(opts.headers || {}),
    },
  });

  if (!res.ok) {
    let errBody: AsaasError = { errors: [{ code: "UNKNOWN", description: `HTTP ${res.status}` }] };
    try { errBody = await res.json(); } catch {}
    throw new AsaasApiError(res.status, errBody.errors || []);
  }

  return res.json();
}

// ── Customers ──

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  mobilePhone: string;
  externalReference: string;
  [key: string]: unknown;
}

export async function getCustomers(params: Record<string, string> = {}): Promise<AsaasCustomer[]> {
  const all: AsaasCustomer[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const qs = new URLSearchParams({ ...params, offset: String(offset), limit: String(limit) });
    const res = await asaasFetch(`/customers?${qs}`);
    const data = res.data as AsaasCustomer[];
    all.push(...data);
    if (!res.hasMore) break;
    offset += limit;
  }
  return all;
}

export async function getCustomerById(id: string): Promise<AsaasCustomer> {
  return asaasFetch(`/customers/${id}`);
}

// createCustomer, updateCustomer REMOVIDOS — integração Asaas é somente leitura (P106)

// ── Payments ──

export interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  status: string;
  billingType: string;
  dueDate: string;
  paymentDate: string | null;
  description: string;
  externalReference: string;
  subscription?: string;
  [key: string]: unknown;
}

export async function getPayments(params: Record<string, string> = {}): Promise<AsaasPayment[]> {
  const all: AsaasPayment[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const qs = new URLSearchParams({ ...params, offset: String(offset), limit: String(limit) });
    const res = await asaasFetch(`/payments?${qs}`);
    const data = res.data as AsaasPayment[];
    all.push(...data);
    if (!res.hasMore) break;
    offset += limit;
  }
  return all;
}

export async function getPaymentById(id: string): Promise<AsaasPayment> {
  return asaasFetch(`/payments/${id}`);
}

// createPayment, createSubscription REMOVIDOS — integração Asaas é somente leitura (P106)

export { AsaasApiError };
