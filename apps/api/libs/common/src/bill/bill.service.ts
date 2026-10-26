import { Injectable, NotFoundException } from '@nestjs/common';
import { billsOverview, findUtility, insurance, utilities } from 'shared';

@Injectable()
export class BillService {
  overview() {
    return billsOverview;
  }

  listUtilities() {
    return utilities;
  }

  getUtility(id: string) {
    const utility = findUtility(id);
    if (!utility) {
      throw new NotFoundException(`Utility ${id} not found`);
    }
    return utility;
  }

  listInsurance() {
    return insurance;
  }
}
