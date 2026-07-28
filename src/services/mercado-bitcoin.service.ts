import { config } from "../config/environment";
import { ConcurrencyLimiter } from "../utils/concurrency-limiter";

const MB_BASE = "https://api.mercadobitcoin.net";
const MB_API_V4 = `${MB_BASE}/api/v4`;

const limiter = new ConcurrencyLimiter(
  Math.max(1, config.mercadoBitcoinMaxConcurrency),
);

// Erro de credencial inválida/revogada — crypto-account.service.ts mapeia isto
// para ConnectedAccountStatus.ERROR em vez de deixar propagar como falha genérica.
export class MercadoBitcoinAuthError extends Error {}

export interface ProviderBalance {
  ticker: string;
  quantity: number;
}

interface MBAccount {
  id: string;
  currency: string;
  name: string;
  type: string;
}

interface MBBalance {
  symbol: string;
  available: string;
  on_hold: string;
  total: string;
}

async function getAccessToken(
  apiKey: string,
  apiSecret: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "global",
    client_id: apiKey,
    client_secret: apiSecret,
  });

  const response = await limiter.run(() =>
    fetch(`${MB_BASE}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }),
  );

  if (response.status === 401 || response.status === 403) {
    throw new MercadoBitcoinAuthError(
      "Credenciais Mercado Bitcoin inválidas ou revogadas",
    );
  }

  if (!response.ok) {
    throw new Error(
      `Mercado Bitcoin OAuth2 error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Mercado Bitcoin não retornou access_token");
  }

  return data.access_token;
}

async function discoverAccountId(accessToken: string): Promise<string> {
  const response = await limiter.run(() =>
    fetch(`${MB_API_V4}/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );

  if (response.status === 401) {
    throw new MercadoBitcoinAuthError("Access token não está ativo");
  }

  if (!response.ok) {
    throw new Error(
      `Mercado Bitcoin accounts error: ${response.status} ${response.statusText}`,
    );
  }

  const accounts = (await response.json()) as MBAccount[];
  const [account] = accounts;

  if (!account) {
    throw new Error("Nenhuma conta encontrada na Mercado Bitcoin");
  }

  return account.id;
}

async function fetchBalances(
  accessToken: string,
  accountId: string,
): Promise<ProviderBalance[]> {
  const response = await limiter.run(() =>
    fetch(`${MB_API_V4}/accounts/${accountId}/balances`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );

  if (response.status === 401) {
    throw new MercadoBitcoinAuthError("Access token não está ativo");
  }

  if (!response.ok) {
    throw new Error(
      `Mercado Bitcoin balances error: ${response.status} ${response.statusText}`,
    );
  }

  const balances = (await response.json()) as MBBalance[];

  return balances
    .filter((balance) => balance.symbol !== "BRL" && Number(balance.total) > 0)
    .map((balance) => ({
      ticker: balance.symbol.toUpperCase(),
      quantity: Number(balance.total),
    }));
}

export class MercadoBitcoinService {
  // Usado na criação da conta: token + descoberta da conta (captura o
  // externalAccountId) + primeiro fetch de saldos, como "sync de teste".
  async connectAndFetchInitialBalances(
    apiKey: string,
    apiSecret: string,
  ): Promise<{ externalAccountId: string; balances: ProviderBalance[] }> {
    const accessToken = await getAccessToken(apiKey, apiSecret);
    const externalAccountId = await discoverAccountId(accessToken);
    const balances = await fetchBalances(accessToken, externalAccountId);

    return { externalAccountId, balances };
  }

  // Usado em syncs subsequentes: já sabemos o externalAccountId, então pulamos
  // a redescoberta de conta (decisão 5.3 só exige token novo a cada sync).
  async fetchBalancesForAccount(
    apiKey: string,
    apiSecret: string,
    externalAccountId: string,
  ): Promise<ProviderBalance[]> {
    const accessToken = await getAccessToken(apiKey, apiSecret);
    return fetchBalances(accessToken, externalAccountId);
  }
}

export const mercadoBitcoinService = new MercadoBitcoinService();
