import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { VarianceRow } from '../models/variance.model';

const MOCK_VARIANCE_ROWS: VarianceRow[] = [
  { item: 'Revenue', current: 285000, comparison: 248000, variance: 37000, varPct: '+14.9%', analysis: 'Revenue increased 14.9% vs prior period.' },
  { item: 'Cost of Sales', current: -168000, comparison: -152000, variance: -16000, varPct: '+10.5%', analysis: 'Cost of sales increased 10.5% vs prior period.' },
  { item: 'Gross Profit', current: 117000, comparison: 96000, variance: 21000, varPct: '+21.9%', analysis: 'Gross profit increased 21.9%, above revenue growth.', isSubtotal: true },
  { item: 'Distribution Costs', current: -18000, comparison: -16000, variance: -2000, varPct: '+12.5%', analysis: 'Distribution costs increased 12.5% vs prior period.' },
  { item: 'G&A Expenses', current: -42000, comparison: -38000, variance: -4000, varPct: '+10.5%', analysis: 'G&A expenses increased 10.5% vs prior period.' },
  { item: 'Finance Costs', current: -3200, comparison: 0, variance: -3200, varPct: 'N/A', analysis: 'Finance costs recorded with no prior-period comparator.' },
  { item: 'Net Profit', current: 71800, comparison: 58000, variance: 13800, varPct: '+23.8%', analysis: 'Net profit increased 23.8%, above revenue growth.', isSubtotal: true },
];

@Injectable({ providedIn: 'root' })
export class VarianceService {
  private mockDelay() {
    return environment.useMockData ? 250 : 0;
  }

  /** Simulates GET {apiUrl}/variance?period=..&comparison=..&entity=..&currency=.. */
  getVarianceRows(): Observable<VarianceRow[]> {
    return of(MOCK_VARIANCE_ROWS).pipe(delay(this.mockDelay()));
  }
}
