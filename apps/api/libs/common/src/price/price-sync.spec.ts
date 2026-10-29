import {
  applyCreateAccount,
  applyCreateHolding,
  applyCreateTransaction,
  collectCryptoPositions,
  emptyLedger,
  fetchUsdQuotes,
  planHoldingMarks,
  quoteTicker,
  type FetchLike,
} from 'shared';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => unknown): FetchLike {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = await handler(url, init);
    if (body instanceof Response) return body;
    return jsonResponse(body);
  }) as FetchLike;
}

describe('quoteTicker', () => {
  it('uses the asset code before a Stellar issuer suffix', () => {
    expect(quoteTicker('USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN')).toBe(
      'USDC',
    );
  });
});

describe('collectCryptoPositions', () => {
  it('nets chain activity as the quantity for a watched crypto asset', () => {
    const snapshot = emptyLedger();
    const account = applyCreateAccount(snapshot, { name: 'Cold wallet', kind: 'crypto' });
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      description: 'Received',
      amount: '1.5',
      asset: 'BTC',
    });
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      description: 'Sent',
      amount: '-0.25',
      asset: 'BTC',
    });
    expect(collectCryptoPositions(snapshot)).toEqual([
      expect.objectContaining({
        accountId: account.id,
        ticker: 'BTC',
        quantity: '1.25000000',
        symbol: 'BTC',
      }),
    ]);
  });

  it('ignores unmapped chain spam tokens', () => {
    const snapshot = emptyLedger();
    const account = applyCreateAccount(snapshot, { name: 'Cold wallet', kind: 'crypto' });
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      description: 'Airdrop',
      amount: '16888',
      asset: 'AZ',
    });
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      description: 'Received',
      amount: '0.5',
      asset: 'ETH',
    });
    expect(collectCryptoPositions(snapshot)).toEqual([
      expect.objectContaining({ ticker: 'ETH', quantity: '0.50000000' }),
    ]);
  });

  it('does not send brokerage tickers that CoinGecko does not cover', () => {
    const snapshot = emptyLedger();
    const account = applyCreateAccount(snapshot, { name: 'Brokerage', kind: 'investment' });
    applyCreateHolding(snapshot, {
      accountId: account.id,
      name: 'Vanguard Total',
      symbol: 'VTI',
      quantity: '10',
      value: '2500',
    });
    expect(collectCryptoPositions(snapshot)).toEqual([]);
  });
});

describe('planHoldingMarks', () => {
  it('values quantity at the USD quote and keeps an existing cost basis', () => {
    const { marks, missing } = planHoldingMarks(
      [
        {
          accountId: 'a1',
          holdingId: 'h1',
          name: 'Bitcoin',
          symbol: 'BTC',
          ticker: 'BTC',
          quantity: '1.25',
          costBasis: '40000.00',
        },
      ],
      new Map([['BTC', '100000']]),
    );
    expect(missing).toEqual([]);
    expect(marks).toEqual([
      {
        accountId: 'a1',
        holdingId: 'h1',
        name: 'Bitcoin',
        symbol: 'BTC',
        quantity: '1.25',
        value: '125000.00',
        costBasis: '40000.00',
      },
    ]);
  });
});

describe('fetchUsdQuotes', () => {
  it('treats stables as $1 and asks CoinGecko for mapped coins', async () => {
    const quotes = await fetchUsdQuotes(['USDC', 'BTC', 'ETH'], {
      apiKey: 'demo-key',
      fetch: mockFetch((url, init) => {
        expect(url).toContain('ids=bitcoin%2Cethereum');
        expect(url).not.toContain('USDC');
        expect((init?.headers as Record<string, string>)['x-cg-demo-api-key']).toBe('demo-key');
        return { bitcoin: { usd: 100000.12 }, ethereum: { usd: 3500 } };
      }),
    });
    expect(quotes.get('USDC')).toBe('1');
    expect(quotes.get('BTC')).toBe('100000.12');
    expect(quotes.get('ETH')).toBe('3500');
  });

  it('looks up leftover tickers by symbol', async () => {
    const quotes = await fetchUsdQuotes(['JUNKCOIN'], {
      fetch: mockFetch((url) => {
        if (url.includes('symbols=junkcoin')) return { junkcoin: { usd: 0.02 } };
        throw new Error(`unexpected ${url}`);
      }),
    });
    expect(quotes.get('JUNKCOIN')).toBe('0.02');
  });
});
