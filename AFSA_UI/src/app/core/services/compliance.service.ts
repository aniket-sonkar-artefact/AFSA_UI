import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { IfrsNote } from '../models/compliance.model';

const MOCK_NOTES: IfrsNote[] = [
  {
    id: 0,
    title: 'Revenue',
    standard: 'IFRS 15 \u2014 Revenue from Contracts with Customers',
    tableHeaders: ['Revenue Category', 'Current Period (SAR)', 'Comparative Period (SAR)'],
    tableRows: [
      ['Product Revenue', '186,000', '162,000'],
      ['Service Revenue', '54,000', '48,000'],
      ['Contract Revenue', '45,000', '38,000'],
      ['Total Revenue', '285,000', '248,000'],
    ],
    defaultNarrative: 'The Group disaggregates revenue from contracts with customers by revenue category in accordance with IFRS 15. Revenue recognition policies are consistent with those applied in the prior period. Variable consideration has been estimated and constrained where applicable.',
    checkResults: [
      { confidence: 88, summary: 'The disclosure substantially addresses IFRS 15 revenue disaggregation requirements. Geographic and product-line disaggregation is present. The narrative may benefit from additional description of performance obligations.' },
      { confidence: 93, summary: 'After revision, the disclosure more comprehensively addresses IFRS 15 requirements. Performance obligations and variable consideration are adequately described.' },
    ],
  },
  {
    id: 1,
    title: 'Related Party Transactions',
    standard: 'IAS 24 \u2014 Related Party Disclosures',
    tableHeaders: ['Related Party Category', 'Transaction Type', 'Amount (SAR)'],
    tableRows: [
      ['Affiliate A', 'Intercompany Payable', '12,000'],
      ['Parent Entity', 'Management Fee', '2,400'],
      ['Key Management', 'Remuneration', '1,800'],
    ],
    defaultNarrative: "The following transactions were carried out with related parties during the reporting period. All transactions are conducted on an arm's-length basis in accordance with the Group's transfer pricing policy. Approval by the Related Party Transactions Committee was obtained prior to execution.",
    checkResults: [
      { confidence: 72, summary: 'The disclosure partially addresses IAS 24 requirements. Related party categories and transaction amounts are present. Further detail on the nature of balances and pricing basis would strengthen compliance.' },
      { confidence: 85, summary: "The revised disclosure more fully addresses IAS 24 requirements. The nature of transactions and arm's-length basis are now clearly described." },
    ],
  },
  {
    id: 2,
    title: 'Borrowings & Liquidity',
    standard: 'IFRS 7 \u2014 Financial Instruments: Disclosures',
    tableHeaders: ['Borrowing Category', 'Carrying Amount (SAR)', 'Maturity'],
    tableRows: [
      ['Revolving Credit Facility', '150,000', 'Q4 2027'],
      ['Lease Liabilities', '8,400', 'Various'],
      ['Total Borrowings', '158,400', '\u2014'],
    ],
    defaultNarrative: 'As at the reporting date, total borrowings comprise a revolving credit facility and lease liabilities recognised under IFRS 16. The Group is in compliance with all financial covenants. Liquidity risk is managed through maintaining adequate committed credit facilities and monitoring cash flow forecasts.',
    checkResults: [
      { confidence: 80, summary: 'The disclosure addresses core IFRS 7 requirements for borrowings. Maturity analysis and interest rate sensitivity disclosure would further strengthen the note.' },
      { confidence: 91, summary: 'The revised disclosure substantially meets IFRS 7 requirements. Liquidity risk management approach and covenant compliance are adequately described.' },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class ComplianceService {
  private mockDelay(ms: number) {
    return environment.useMockData ? ms : 0;
  }

  /** Simulates GET {apiUrl}/compliance/notes */
  getNotes(): Observable<IfrsNote[]> {
    return of(MOCK_NOTES).pipe(delay(this.mockDelay(250)));
  }

  /**
   * Simulates POST {apiUrl}/compliance/notes/{id}/check — running an
   * on-demand IFRS compliance check against the (possibly edited) narrative.
   * `runCount` selects which canned result to return, mirroring the
   * "check again after revision" behaviour in the original design.
   */
  runComplianceCheck(noteId: number, narrative: string, runCount: number) {
    const note = MOCK_NOTES.find((n) => n.id === noteId)!;
    const result = note.checkResults[Math.min(runCount, note.checkResults.length - 1)];
    return of(result).pipe(delay(this.mockDelay(1600)));
  }
}
