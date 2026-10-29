import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  IndexerError,
  collectCryptoPositions,
  fetchUsdQuotes,
  planHoldingMarks,
  sum,
  type PriceSyncResult,
} from 'shared';
import { ENV, Env } from '@libs/config';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class PriceSyncService {
  private readonly logger = new Logger(PriceSyncService.name);

  constructor(
    private readonly ledger: LedgerService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async sync(): Promise<PriceSyncResult> {
    const snapshot = await this.ledger.snapshot();
    const positions = collectCryptoPositions(snapshot);
    if (positions.length === 0) {
      return emptyResult();
    }

    let quotes: Map<string, string>;
    try {
      quotes = await fetchUsdQuotes(
        positions.map((row) => row.ticker),
        {
          apiKey: this.env.COINGECKO_API_KEY,
          onLog: (line) => this.logger.log(line),
        },
      );
    } catch (error) {
      if (error instanceof IndexerError && error.status === 429) {
        throw new ServiceUnavailableException(error.message);
      }
      const message = error instanceof Error ? error.message : 'CoinGecko request failed';
      throw new BadRequestException(message);
    }

    const { marks, missing } = planHoldingMarks(positions, quotes);
    let createdCount = 0;
    let updatedCount = 0;
    const touched = new Set<string>();
    for (const mark of marks) {
      if (mark.holdingId) {
        await this.ledger.updateHolding(mark.holdingId, {
          quantity: mark.quantity,
          value: mark.value,
        });
        updatedCount += 1;
      } else {
        await this.ledger.createHolding({
          accountId: mark.accountId,
          name: mark.name,
          symbol: mark.symbol,
          quantity: mark.quantity,
          value: mark.value,
          costBasis: mark.costBasis,
        });
        createdCount += 1;
      }
      touched.add(mark.accountId);
    }

    const after = await this.ledger.snapshot();
    for (const account of after.accounts) {
      if (!touched.has(account.id) || account.kind !== 'crypto') continue;
      const total = sum(
        after.holdings.filter((row) => row.accountId === account.id).map((row) => row.value),
      );
      await this.ledger.updateAccount(account.id, { balance: total.toFixed(2) });
    }

    this.logger.log(
      `Price sync marked ${marks.length} holdings (${createdCount} new, ${updatedCount} updated)`,
    );
    return {
      quotedCount: quotes.size,
      markedCount: marks.length,
      createdCount,
      updatedCount,
      skippedCount: positions.length - marks.length,
      missing,
    };
  }
}

function emptyResult(): PriceSyncResult {
  return {
    quotedCount: 0,
    markedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    missing: [],
  };
}
