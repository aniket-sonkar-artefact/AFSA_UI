import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GenerationHistoryRow, GenerationStepEvent, ReadinessItem, VarianceRow } from '../models/variance.model';

export const GENERATION_STEPS: string[] = [
  'Preparing consolidated financial data',
  'Loading standardized template',
  'Generating management commentary',
  'Populating charts and tables',
  'Applying standardized formatting',
  'Validating and finalising PPTX',
];

export const READINESS_ITEMS: ReadinessItem[] = [
  { label: 'Consolidated financials available', detail: 'Group financial results loaded' },
  { label: 'Variance analysis available', detail: 'Period movements assessed' },
  { label: 'Standardized template loaded', detail: 'Finance Management Report v2026.1' },
  { label: 'Reporting context confirmed', detail: 'Group Consolidated' },
];

const MOCK_GENERATION_HISTORY: GenerationHistoryRow[] = [
  { period: 'Q4 2025', fileName: 'Q4_2025_Management_Report.pptx', date: '31 Mar 2026', status: 'Previous' },
];

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

  /** Simulates GET {apiUrl}/variance/management-report/history */
  getGenerationHistory(): Observable<GenerationHistoryRow[]> {
    return of(MOCK_GENERATION_HISTORY).pipe(delay(this.mockDelay()));
  }

  /**
   * Mocked, swap-ready Management Report generation (matches the file-upload mock's
   * pattern in SubmissionReviewService). Emits a step-progress event as each stage of
   * GENERATION_STEPS is reached, then a final `done: true` event once the report is
   * ready. A real backend endpoint (e.g. HttpClient POST with reportProgress: true)
   * would emit the same event shape, so only this method's body changes later.
   */
  generateManagementReport(): Observable<GenerationStepEvent> {
    return new Observable<GenerationStepEvent>((subscriber) => {
      const lastIndex = GENERATION_STEPS.length - 1;

      if (!environment.useMockData) {
        subscriber.next({ stepIndex: lastIndex, stepLabel: GENERATION_STEPS[lastIndex], done: true });
        subscriber.complete();
        return;
      }

      const timers: ReturnType<typeof setTimeout>[] = [];

      GENERATION_STEPS.forEach((stepLabel, index) => {
        timers.push(
          setTimeout(() => {
            subscriber.next({ stepIndex: index, stepLabel, done: false });
            if (index === lastIndex) {
              timers.push(
                setTimeout(() => {
                  subscriber.next({ stepIndex: index, stepLabel, done: true });
                  subscriber.complete();
                }, 750),
              );
            }
          }, index * 850),
        );
      });

      return () => timers.forEach((id) => clearTimeout(id));
    });
  }
}
