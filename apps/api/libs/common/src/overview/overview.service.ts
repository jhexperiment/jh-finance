import { Injectable } from '@nestjs/common';
import { banksOverview, cardsOverview, overview } from 'shared';

@Injectable()
export class OverviewService {
  snapshot() {
    return overview;
  }

  cards() {
    return cardsOverview;
  }

  banks() {
    return banksOverview;
  }
}
