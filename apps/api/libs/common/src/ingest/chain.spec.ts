import {
  IndexerError,
  applyCreateAccount,
  applyCreateChainAddress,
  applyCreateTransaction,
  commitChainTransactions,
  deriveHdAddress,
  dexMatchesForHoldings,
  emptyLedger,
  fetchAddressTransactions,
  projectInvestment,
  type ChainTx,
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

describe('fetchAddressTransactions', () => {
  it('pages Esplora BTC history and nets satoshis for the watched address', async () => {
    const address = '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv';
    const firstPage = Array.from({ length: 25 }, (_, index) =>
      esploraTx(`tx-${index}`, address, 1149, 0),
    );
    firstPage[0] = esploraTx('receive', address, 1149, 0);
    firstPage[1] = esploraTx('send', address, 1149, 2361);
    const calls: string[] = [];
    const rows = await fetchAddressTransactions({
      chain: 'btc',
      address,
      fetch: mockFetch((url) => {
        calls.push(url);
        if (url.endsWith('/txs/chain')) return firstPage;
        if (url.endsWith('/txs/chain/tx-24')) return [esploraTx('tail', address, 5000, 0)];
        return [];
      }),
    });
    expect(calls).toHaveLength(2);
    expect(rows).toHaveLength(26);
    expect(rows[0]).toMatchObject({
      chain: 'btc',
      txid: 'receive',
      asset: 'BTC',
      amount: '0.00001149',
      direction: 'in',
      to: address,
    });
    expect(rows[1]).toMatchObject({
      txid: 'send',
      amount: '-0.00001212',
      direction: 'out',
      from: address,
    });
    expect(rows[25]?.txid).toBe('tail');
  });

  it('pages Blockscout ETH native txs and ERC-20 transfers', async () => {
    const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const rows = await fetchAddressTransactions({
      chain: 'eth',
      address,
      fetch: mockFetch((url) => {
        if (url.includes('/token-transfers') && url.includes('block_number=10')) {
          return { items: [], next_page_params: null };
        }
        if (url.includes('/token-transfers')) {
          return {
            items: [
              {
                transaction_hash: '0xtoken',
                timestamp: '2026-01-02T00:00:00.000Z',
                from: { hash: '0xabc' },
                to: { hash: address },
                token: { symbol: 'USDC', decimals: '6', type: 'ERC-20' },
                token_type: 'ERC-20',
                total: { value: '2500000', decimals: '6' },
              },
            ],
            next_page_params: { block_number: 10 },
          };
        }
        if (url.includes('/transactions') && url.includes('block_number=8')) {
          return { items: [], next_page_params: null };
        }
        if (url.includes('/transactions')) {
          return {
            items: [
              {
                hash: '0xnative',
                timestamp: '2026-01-01T00:00:00.000Z',
                value: '1000000000000000000',
                result: 'success',
                from: { hash: '0xfrom' },
                to: { hash: address },
              },
              {
                hash: '0xskip',
                timestamp: '2026-01-01T00:00:01.000Z',
                value: '0',
                result: 'success',
                from: { hash: address },
                to: { hash: '0xcontract' },
              },
            ],
            next_page_params: { block_number: 8 },
          };
        }
        throw new Error(url);
      }),
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      chain: 'eth',
      txid: '0xnative',
      asset: 'ETH',
      amount: '1',
      direction: 'in',
    });
    expect(rows[1]).toMatchObject({
      txid: '0xtoken',
      asset: 'USDC',
      amount: '2.5',
      direction: 'in',
    });
  });

  it('pages BNB Beacon explorer history and pulls linked BSC balances', async () => {
    const address = 'bnb1hd4la4eqvukujqklfv839euvy9zhxrrnhzu45j';
    const evm = '0x9e51b28061ac51b8fad1b6bc49488d260f6b5921';
    const rows = await fetchAddressTransactions({
      chain: 'bnb',
      address,
      fetch: mockFetch((url) => {
        if (url.includes('explorer.bnbchain.org')) {
          return {
            txNums: 3,
            txArray: [
              {
                txHash: 'cross-out',
                timeStamp: 1716336499957,
                fromAddr: address,
                value: 9.90210411,
                txAsset: 'BNB',
                data: JSON.stringify({
                  toAddress: evm,
                  amount: { amount: 990210411, denom: 'BNB' },
                }),
                code: 0,
              },
              {
                txHash: 'token-in',
                timeStamp: 1565648767376,
                fromAddr: 'bnb1fahe7y8sz9h0r9wm8yvnu8ujm2244lr22cm76f',
                toAddr: address,
                value: 7,
                txAsset: 'VRAB-B56',
                code: 0,
              },
              {
                txHash: 'child-skip',
                timeStamp: 1563637753153,
                txFee: 0.15,
                hasChildren: 1,
                code: 0,
              },
            ],
          };
        }
        if (url.includes('binplorer.com') && url.includes(evm)) {
          return {
            ETH: { rawBalance: '9902104110000000000' },
            tokens: [
              {
                tokenInfo: { symbol: 'MSVP', decimals: '18' },
                rawBalance: '951079956392981374',
              },
            ],
          };
        }
        throw new Error(url);
      }),
    });
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      chain: 'bnb',
      txid: 'cross-out',
      asset: 'BNB',
      amount: '-9.90210411',
      direction: 'out',
      to: evm,
    });
    expect(rows[1]).toMatchObject({
      txid: 'token-in',
      asset: 'VRAB-B56',
      amount: '7',
      direction: 'in',
    });
    expect(rows[2]).toMatchObject({
      txid: `bsc-balance:${evm}:BNB`,
      asset: 'BNB',
      amount: '9.90210411',
      direction: 'in',
      to: evm,
    });
    expect(rows[3]).toMatchObject({
      asset: 'MSVP',
      direction: 'in',
    });
  });

  it('reads BNB Smart Chain balances from Binplorer without an Etherscan key', async () => {
    const address = '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3';
    const rows = await fetchAddressTransactions({
      chain: 'bnb',
      address,
      fetch: mockFetch((url) => {
        if (!url.includes('binplorer.com')) throw new Error(url);
        return {
          ETH: { rawBalance: '1500000000000000000' },
          tokens: [
            {
              tokenInfo: { symbol: 'USDT', decimals: '18' },
              rawBalance: '2500000000000000000',
            },
          ],
        };
      }),
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ asset: 'BNB', amount: '1.5', direction: 'in' });
    expect(rows[1]).toMatchObject({ asset: 'USDT', amount: '2.5', direction: 'in' });
  });

  it('uses Etherscan for BNB Smart Chain 0x when a key is present', async () => {

    const address = '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3';
    const rows = await fetchAddressTransactions({
      chain: 'bnb',
      address,
      etherscanApiKey: 'test-key',
      fetch: mockFetch((url) => {
        const parsed = new URL(url);
        if (parsed.searchParams.get('action') === 'txlist') {
          return {
            status: '1',
            result: [
              {
                hash: '0xbnb',
                timeStamp: '1700000000',
                from: address,
                to: '0xdest',
                value: '2000000000000000000',
                isError: '0',
                blockNumber: '10',
              },
            ],
          };
        }
        return {
          status: '1',
          result: [
            {
              hash: '0xbusd',
              timeStamp: '1700000001',
              from: '0xsrc',
              to: address,
              value: '1500000000000000000',
              tokenSymbol: 'BUSD',
              tokenDecimal: '18',
              blockNumber: '11',
            },
          ],
        };
      }),
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      chain: 'bsc',
      asset: 'BNB',
      amount: '-2',
      direction: 'out',
    });
    expect(rows[1]).toMatchObject({ asset: 'BUSD', amount: '1.5', direction: 'in' });
  });

  it('pages XRPL account_tx with a marker and skips failed payments', async () => {
    const address = 'rLNaPoKeeBjZe2qs6x52yVPZpZ8td4dc6w';
    let bodies: unknown[] = [];
    const rows = await fetchAddressTransactions({
      chain: 'xrp',
      address,
      fetch: mockFetch(async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body ?? '{}')));
        const marker = (bodies[bodies.length - 1] as { params: Array<{ marker?: unknown }> })
          .params[0]?.marker;
        if (!marker) {
          return {
            result: {
              transactions: [
                xrpPayment('hash-1', address, 'rDest', '1000000', 'tesSUCCESS'),
                xrpPayment('hash-fail', address, 'rDest', '5', 'tecUNFUNDED_PAYMENT'),
              ],
              marker: { ledger: 1, seq: 2 },
            },
          };
        }
        return {
          result: {
            transactions: [xrpPayment('hash-2', 'rOther', address, '2500000', 'tesSUCCESS')],
          },
        };
      }),
    });
    expect(bodies).toHaveLength(2);
    expect(rows.map((row) => row.txid)).toEqual(['hash-1', 'hash-2']);
    expect(rows[0]).toMatchObject({ asset: 'XRP', amount: '-1', direction: 'out' });
    expect(rows[1]).toMatchObject({ asset: 'XRP', amount: '2.5', direction: 'in' });
  });

  it('follows Horizon payment pages for XLM', async () => {
    const address = 'GA2VRL65L3ZFEDDJ357RGI3MAOKPJZ2Z3IJTPSC24I4KDTNFSVEQURRA';
    const rows = await fetchAddressTransactions({
      chain: 'xlm',
      address,
      horizonUrl: 'https://horizon.test',
      fetch: mockFetch((url) => {
        if (url.includes('cursor=2')) {
          return { _links: {}, _embedded: { records: [] } };
        }
        return {
          _links: {
            next: { href: 'https://horizon.test/accounts/x/payments?cursor=2&order=asc&limit=200' },
          },
          _embedded: {
            records: [
              {
                transaction_successful: true,
                transaction_hash: 'xlm-1',
                created_at: '2018-12-01T00:00:00Z',
                type: 'payment',
                from: 'GSRC',
                to: address,
                amount: '12.5',
                asset_type: 'native',
              },
              {
                transaction_successful: true,
                transaction_hash: 'usdc-1',
                created_at: '2018-12-02T00:00:00Z',
                type: 'payment',
                from: address,
                to: 'GDEST',
                amount: '3',
                asset_type: 'credit_alphanum4',
                asset_code: 'USDC',
                asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
              },
            ],
          },
        };
      }),
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      chain: 'xlm',
      asset: 'XLM',
      amount: '12.5',
      direction: 'in',
      at: '2018-12-01T00:00:00Z',
    });
    expect(rows[1]?.asset).toContain('USDC-');
    expect(rows[1]?.amount).toBe('-3');
  });

  it('derives BIP-84 native SegWit addresses from a zpub', () => {
    const zpub =
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
    expect(deriveHdAddress('btc', zpub, 'p2wpkh', 0, 0)).toBe(
      'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
    );
    expect(deriveHdAddress('btc', zpub, 'p2wpkh', 0, 1)).toBe(
      'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g',
    );
    expect(deriveHdAddress('btc', zpub, 'p2wpkh', 1, 0)).toBe(
      'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el',
    );
  });

  it('walks a zpub receive/change gap and imports used addresses', async () => {
    const zpub =
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
    const used = deriveHdAddress('btc', zpub, 'p2wpkh', 0, 0);
    const taproot = deriveHdAddress('btc', zpub, 'p2tr', 0, 0);
    const rows = await fetchAddressTransactions({
      chain: 'btc',
      address: zpub,
      gapLimit: 2,
      delayMs: 0,
      fetch: mockFetch((url) => {
        if (url.includes(`/address/${used}/txs/chain`)) {
          return [esploraTx('zpub-receive', used, 100_000, 0)];
        }
        if (url.includes(`/address/${used}`) && !url.includes('/txs')) {
          return { chain_stats: { tx_count: 1 }, mempool_stats: { tx_count: 0 } };
        }
        if (url.includes(`/address/${taproot}`)) {
          return { chain_stats: { tx_count: 0 }, mempool_stats: { tx_count: 0 } };
        }
        if (url.includes('/address/') && !url.includes('/txs')) {
          return { chain_stats: { tx_count: 0 }, mempool_stats: { tx_count: 0 } };
        }
        return [];
      }),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      txid: 'zpub-receive',
      to: used,
      asset: 'BTC',
      amount: '0.001',
      direction: 'in',
    });
  });

  it('falls back to Litecoin blockbook after esplora 504s', async () => {
    const address = 'LfMjNgBL1tSMgZHtwv8ZunZb4uQNQQkKLF';
    const rows = await fetchAddressTransactions({
      chain: 'ltc',
      address,
      fetch: mockFetch((url) => {
        if (url.includes('litecoinspace.org')) {
          return new Response('', { status: 504, headers: { 'Retry-After': '30' } });
        }
        if (url.includes('blockbook.ltc.zelcore.io') && url.includes('details=txs')) {
          return {
            page: 1,
            totalPages: 1,
            transactions: [
              {
                txid: 'ltc-in',
                blockTime: 1565405477,
                confirmations: 12,
                vin: [{ addresses: ['Lother'], value: '150000000' }],
                vout: [{ addresses: [address], value: '150000000' }],
              },
            ],
          };
        }
        return { txs: 1, transactions: [] };
      }),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      chain: 'ltc',
      txid: 'ltc-in',
      asset: 'LTC',
      amount: '1.5',
      direction: 'in',
      to: address,
    });
  });

  it('retries Esplora 429s then continues', async () => {
    const address = '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv'
    let hits = 0
    const rows = await fetchAddressTransactions({
      chain: 'btc',
      address,
      fetch: mockFetch((url) => {
        if (url.endsWith('/txs/chain')) {
          hits += 1
          if (hits === 1) {
            return new Response('', { status: 429, headers: { 'Retry-After': '0' } })
          }
          return [esploraTx('after-429', address, 1149, 0)]
        }
        return []
      }),
    })
    expect(hits).toBe(2)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.txid).toBe('after-429')
  })

  it('retries a dropped fetch then continues', async () => {
    const address = '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv'
    let hits = 0
    const rows = await fetchAddressTransactions({
      chain: 'btc',
      address,
      fetch: (async (input) => {
        hits += 1
        if (hits === 1) throw new TypeError('fetch failed')
        return jsonResponse([esploraTx('after-drop', address, 1149, 0)])
      }) as FetchLike,
    })
    expect(hits).toBe(2)
    expect(rows[0]?.txid).toBe('after-drop')
  })

  it('rejects an extended private key and xpubs on non-UTXO chains', async () => {
    await expect(
      fetchAddressTransactions({
        chain: 'btc',
        address:
          'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
      }),
    ).rejects.toThrow('extended private key');
    await expect(
      fetchAddressTransactions({
        chain: 'eth',
        address:
          'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
      }),
    ).rejects.toThrow('Bitcoin and Litecoin');
  });

  it('rejects an empty address or unknown chain', async () => {
    await expect(fetchAddressTransactions({ chain: 'btc', address: '  ' })).rejects.toThrow(
      'Address is required.',
    );
    await expect(
      fetchAddressTransactions({ chain: 'doge', address: 'Dsomething' }),
    ).rejects.toThrow('Unsupported chain');
  });
});

describe('commitChainTransactions', () => {
  it('stores native amounts, skips duplicates, and shows them on the crypto account', () => {
    const snapshot = emptyLedger();
    const account = applyCreateAccount(snapshot, { name: 'Cold wallet', kind: 'crypto' });
    const watched = applyCreateChainAddress(snapshot, {
      accountId: account.id,
      chain: 'btc',
      address: '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv',
    });
    const tx: ChainTx = {
      chain: 'btc',
      txid: 'abc',
      at: '2018-12-01T00:00:00.000Z',
      from: '1otherxxxxxxxxxxxxxxxxxxxxxxxxx',
      to: '1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv',
      asset: 'BTC',
      amount: '0.00001149',
      direction: 'in',
    };
    const first = commitChainTransactions(snapshot, account.id, watched.id, [tx]);
    const second = commitChainTransactions(snapshot, account.id, watched.id, [tx]);
    expect(first.importedCount).toBe(1);
    expect(second.importedCount).toBe(0);
    expect(second.skippedCount).toBe(1);
    expect(snapshot.transactions[0]?.asset).toBe('BTC');
    expect(snapshot.transactions[0]?.amount).toBe('0.00001149');
    const view = projectInvestment(account, snapshot);
    expect(view.activity[0]?.amount).toBe('+0.00001149 BTC');
    expect(view.chainAddresses).toHaveLength(1);
    expect(view.extra).toBe('1 holding');
    expect(view.holdingTotal).toBe('0.00001149 BTC');
  });

  it('splits BNB Beacon Chain and BNB Smart Chain holdings', () => {
    const snapshot = emptyLedger();
    const account = applyCreateAccount(snapshot, { name: 'Cold wallet', kind: 'crypto' });
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      description: 'Beacon leftover',
      amount: '0.004',
      asset: 'BNB',
      externalId: 'bnb:beacon:BNB:a:b:0.004',
    });
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      description: 'BEP2 token',
      amount: '7',
      asset: 'VRAB-B56',
      externalId: 'bnb:token:VRAB-B56:a:b:7',
    });
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      description: 'BSC BNB',
      amount: '9.90210411',
      asset: 'BNB',
      externalId: 'bnb:bsc-balance:0xabc:BNB',
    });
    applyCreateTransaction(snapshot, {
      accountId: account.id,
      description: 'BEP20 token',
      amount: '0.95',
      asset: 'MSVP',
      externalId: 'bnb:bsc-balance:0xabc:MSVP',
    });
    const view = projectInvestment(account, snapshot);
    expect(view.holdingGroups?.map((row) => row.name)).toEqual([
      'BNB Beacon Chain',
      'BNB Smart Chain',
    ]);
    expect(view.holdingGroups?.[0]).toMatchObject({
      symbol: 'BNB',
      quantity: '0.004',
      chain: 'bnb',
    });
    expect(view.holdingGroups?.[0]?.tokens?.map((row) => row.symbol)).toEqual(['VRAB']);
    expect(view.holdingGroups?.[1]).toMatchObject({
      symbol: 'BNB',
      quantity: '9.90210411',
      chain: 'bsc',
    });
    expect(view.holdingGroups?.[1]?.tokens?.map((row) => row.symbol)).toEqual(['MSVP']);
    const matches = dexMatchesForHoldings(view.holdingGroups ?? []);
    expect(matches.map((row) => row.venue.name)).toEqual([
      'PancakeSwap',
      'THENA',
      'Uniswap',
      '1inch',
    ]);
    expect(matches[0]?.assets.map((row) => row.symbol)).toEqual(['BNB', 'MSVP']);
    expect(matches[0]?.networks).toEqual(['BNB Smart Chain']);
  });
});

function esploraTx(txid: string, address: string, received: number, sent: number) {
  return {
    txid,
    vin: sent
      ? [{ prevout: { scriptpubkey_address: address, value: sent } }]
      : [{ prevout: { scriptpubkey_address: '1other', value: received } }],
    vout: received
      ? [{ scriptpubkey_address: address, value: received }]
      : [{ scriptpubkey_address: '1other', value: sent }],
    status: { confirmed: true, block_time: 1764102622 },
  };
}

function xrpPayment(
  hash: string,
  from: string,
  to: string,
  drops: string,
  result: string,
) {
  return {
    hash,
    close_time_iso: '2018-12-01T00:00:00Z',
    tx_json: {
      Account: from,
      Destination: to,
      TransactionType: 'Payment',
      Amount: drops,
    },
    meta: { TransactionResult: result, delivered_amount: drops },
  };
}
