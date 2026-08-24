import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Affiliate,
  ChecklistGroup,
  CoaRow,
  Finding,
  FindingStatus,
  UploadProgressEvent,
} from '../models/submission-review.model';

const MOCK_FINDINGS: Record<Affiliate, Finding[]> = {
  A: [
    { accountCode: '1100', account: 'Trade Receivables', currentPeriod: '(3,400,000)', priorPeriod: '1,100,000', change: '\u2212409%', flag: 'Unusual credit balance', flagColumn: 'current', severity: 'High', status: 'Open' },
    { accountCode: '1310', account: 'Prepaid Expenses', currentPeriod: '800,000', priorPeriod: '250,000', change: '+215%', flag: 'Significant period movement', flagColumn: 'change', severity: 'High', status: 'Open' },
    { accountCode: '2210', account: 'Intercompany Payable', currentPeriod: '12,000,000', priorPeriod: '\u2014', change: 'New balance', flag: 'No matching IC receivable', flagColumn: 'current', severity: 'High', status: 'Open' },
    { accountCode: '2300', account: 'Accrued Liabilities', currentPeriod: '4,200,000', priorPeriod: '1,400,000', change: '+200%', flag: 'Value outside expected range', flagColumn: 'change', severity: 'Medium', status: 'Open' },
  ],
  B: [
    { accountCode: '5100', account: 'Cost of Sales', currentPeriod: '168,000,000', priorPeriod: '142,000,000', change: '+18.3%', flag: 'Unexpected account behavior', flagColumn: 'change', severity: 'Medium', status: 'Open' },
    { accountCode: '6210', account: 'Other Operating Expenses', currentPeriod: '(1,200,000)', priorPeriod: '800,000', change: '\u2212250%', flag: 'Unusual credit balance', flagColumn: 'current', severity: 'High', status: 'Open' },
  ],
};

const MOCK_COA: Record<Affiliate, CoaRow[]> = {
  A: [
    { code: '410110', description: 'Local Revenue', originalStatus: 'High Confidence', selectedMapping: 'Revenue', confirmed: false },
    { code: '500100', description: 'Cost of Goods Sold', originalStatus: 'High Confidence', selectedMapping: 'Cost of Sales', confirmed: false },
    { code: '522410', description: 'Plant Repairs', originalStatus: 'Low Confidence', selectedMapping: 'Administrative Expenses', confirmed: false },
    { code: '612000', description: 'Salaries & Allowances', originalStatus: 'Low Confidence', selectedMapping: 'Employee Benefits', confirmed: false },
    { code: '791100', description: 'Other Charges', originalStatus: 'Unmapped', selectedMapping: '', confirmed: false },
  ],
  B: [
    { code: '410200', description: 'International Revenue', originalStatus: 'High Confidence', selectedMapping: 'Revenue', confirmed: false },
    { code: '510100', description: 'Direct Labour', originalStatus: 'High Confidence', selectedMapping: 'Cost of Sales', confirmed: false },
    { code: '580300', description: 'Freight & Logistics', originalStatus: 'Low Confidence', selectedMapping: 'Distribution Costs', confirmed: false },
    { code: '610500', description: 'Office Expenses', originalStatus: 'High Confidence', selectedMapping: 'Administrative Expenses', confirmed: false },
    { code: '720100', description: 'Other Income', originalStatus: 'Unmapped', selectedMapping: '', confirmed: false },
  ],
};

const MOCK_CHECKLIST: Record<Affiliate, ChecklistGroup[]> = {
  A: [
    { group: 'Primary Financial Statements', items: [
      { label: 'Trial Balance', file: 'TB_AffiliateA_Q12026.xlsx', status: 'Complete' },
      { label: 'Income Statement', file: 'IS_AffiliateA_Q12026.xlsx', status: 'Complete' },
      { label: 'Balance Sheet', file: 'BS_AffiliateA_Q12026.xlsx', status: 'Complete' },
      { label: 'Cash Flow Statement', file: '\u2014', status: 'Incomplete' },
    ] },
    { group: 'Notes & Disclosures', items: [
      { label: 'Notes to Financial Statements', file: 'Notes_AffiliateA_Q12026.docx', status: 'Incomplete' },
      { label: 'Related Party Schedule', file: '\u2014', status: 'Missing' },
      { label: 'Borrowings Note', file: 'Borrowings_AffiliateA_Q12026.xlsx', status: 'Complete' },
    ] },
    { group: 'Supporting Schedules', items: [
      { label: 'Intercompany Schedule', file: 'IC_AffiliateA_Q12026.xlsx', status: 'Incomplete' },
      { label: 'Fixed Asset Schedule', file: 'FA_AffiliateA_Q12026.xlsx', status: 'Complete' },
    ] },
    { group: 'Mapping Files', items: [
      { label: 'CoA Mapping File', file: 'CoA_AffiliateA_Q12026.xlsx', status: 'Complete' },
      { label: 'Currency Translation Table', file: 'FX_AffiliateA_Q12026.xlsx', status: 'Complete' },
    ] },
  ],
  B: [
    { group: 'Primary Financial Statements', items: [
      { label: 'Trial Balance', file: 'TB_AffiliateB_Q12026.xlsx', status: 'Complete' },
      { label: 'Income Statement', file: 'IS_AffiliateB_Q12026.xlsx', status: 'Complete' },
      { label: 'Balance Sheet', file: 'BS_AffiliateB_Q12026.xlsx', status: 'Complete' },
      { label: 'Cash Flow Statement', file: 'CF_AffiliateB_Q12026.xlsx', status: 'Complete' },
    ] },
    { group: 'Notes & Disclosures', items: [
      { label: 'Notes to Financial Statements', file: 'Notes_AffiliateB_Q12026.docx', status: 'Complete' },
      { label: 'Related Party Schedule', file: 'RP_AffiliateB_Q12026.xlsx', status: 'Complete' },
      { label: 'Borrowings Note', file: '\u2014', status: 'Not Applicable' },
    ] },
    { group: 'Supporting Schedules', items: [
      { label: 'Intercompany Schedule', file: 'IC_AffiliateB_Q12026.xlsx', status: 'Complete' },
      { label: 'Fixed Asset Schedule', file: 'FA_AffiliateB_Q12026.xlsx', status: 'Complete' },
    ] },
    { group: 'Mapping Files', items: [
      { label: 'CoA Mapping File', file: 'CoA_AffiliateB_Q12026.xlsx', status: 'Complete' },
      { label: 'Currency Translation Table', file: 'FX_AffiliateB_Q12026.xlsx', status: 'Complete' },
    ] },
  ],
};

export const GROUP_ACCOUNTS = [
  'Revenue', 'Cost of Sales', 'Gross Profit', 'Distribution Costs', 'Administrative Expenses',
  'Employee Benefits', 'Maintenance Expense', 'Finance Costs', 'Other Operating Expenses',
  'Other Income', 'Tax Expense',
];

@Injectable({ providedIn: 'root' })
export class SubmissionReviewService {
  private readonly findingsState = signal<Record<Affiliate, Finding[]>>(structuredClone(MOCK_FINDINGS));
  private readonly coaState = signal<Record<Affiliate, CoaRow[]>>(structuredClone(MOCK_COA));

  readonly findings = this.findingsState.asReadonly();
  readonly coaRows = this.coaState.asReadonly();

  private mockDelay() {
    return environment.useMockData ? 250 : 0;
  }

  /** Simulates GET {apiUrl}/affiliates/{affiliate}/checklist */
  getChecklist(affiliate: Affiliate): Observable<ChecklistGroup[]> {
    return of(MOCK_CHECKLIST[affiliate]).pipe(delay(this.mockDelay()));
  }

  /** Simulates GET {apiUrl}/affiliates/{affiliate}/findings */
  getFindings(affiliate: Affiliate): Observable<Finding[]> {
    return of(this.findingsState()[affiliate]).pipe(delay(this.mockDelay()));
  }

  /** Simulates PATCH {apiUrl}/affiliates/{affiliate}/findings/{index} */
  updateFindingStatus(affiliate: Affiliate, index: number, status: FindingStatus): Observable<Finding> {
    const updated = this.findingsState()[affiliate].map((f, i) => (i === index ? { ...f, status } : f));
    return of(updated[index]).pipe(
      delay(this.mockDelay()),
      tap(() => this.findingsState.update((prev) => ({ ...prev, [affiliate]: updated }))),
    );
  }

  /** Simulates GET {apiUrl}/affiliates/{affiliate}/coa-mapping */
  getCoaRows(affiliate: Affiliate): Observable<CoaRow[]> {
    return of(this.coaState()[affiliate]).pipe(delay(this.mockDelay()));
  }

  /** Simulates PATCH {apiUrl}/affiliates/{affiliate}/coa-mapping/{index} */
  updateCoaMapping(affiliate: Affiliate, index: number, value: string): Observable<CoaRow> {
    const updated = this.coaState()[affiliate].map((r, i) => (i === index ? { ...r, selectedMapping: value } : r));
    return of(updated[index]).pipe(
      delay(this.mockDelay()),
      tap(() => this.coaState.update((prev) => ({ ...prev, [affiliate]: updated }))),
    );
  }

  /** Simulates POST {apiUrl}/affiliates/{affiliate}/coa-mapping/{index}/confirm */
  confirmCoaMapping(affiliate: Affiliate, index: number): Observable<CoaRow> {
    const updated = this.coaState()[affiliate].map((r, i) => (i === index ? { ...r, confirmed: true } : r));
    return of(updated[index]).pipe(
      delay(this.mockDelay()),
      tap(() => this.coaState.update((prev) => ({ ...prev, [affiliate]: updated }))),
    );
  }

  /**
   * Simulates POST {apiUrl}/affiliates/{affiliate}/checklist/{item}/file with
   * upload progress reporting. Emits {@link UploadProgressEvent}s as progress
   * climbs from 0 -> 100, matching the shape `HttpClient.request(..., {
   * reportProgress: true, observe: 'events' })` would produce once a real
   * upload endpoint exists, so swapping this method's body for a real
   * `HttpClient` call is a one-file change — callers don't need to change.
   */
  simulateFileUpload(): Observable<UploadProgressEvent> {
    return new Observable<UploadProgressEvent>((subscriber) => {
      if (!environment.useMockData) {
        subscriber.next({ progress: 100, done: true });
        subscriber.complete();
        return;
      }
      let progress = 0;
      const id = setInterval(() => {
        progress = Math.min(100, progress + Math.round(Math.random() * 22 + 12));
        const done = progress >= 100;
        subscriber.next({ progress, done });
        if (done) {
          subscriber.complete();
          clearInterval(id);
        }
      }, 220);
      return () => clearInterval(id);
    });
  }
}
