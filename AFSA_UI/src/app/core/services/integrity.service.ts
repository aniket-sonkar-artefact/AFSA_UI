import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { FootingRow, XRefRow } from '../models/integrity.model';

const MOCK_XREFS: XRefRow[] = [
  { id: 0, statement: 'Income Statement \u2014 Revenue', referencedNote: 'Note 4', referencedTopic: 'Revenue from Contracts', result: 'Reference Valid', status: 'Complete', completed: false },
  { id: 1, statement: 'Balance Sheet \u2014 Borrowings', referencedNote: 'Note 11', referencedTopic: 'Borrowings & Liquidity', result: 'Reference Valid', status: 'Complete', completed: false },
  { id: 2, statement: 'Income Statement \u2014 Finance Costs', referencedNote: 'Note 7', referencedTopic: 'Employee Benefits', result: 'Reference Mismatch', status: 'Flagged', issue: 'The referenced note does not correspond to the financial statement line item. Note 7 relates to Employee Benefits, not Finance Costs.', completed: false },
  { id: 3, statement: 'Balance Sheet \u2014 Intercompany Payable', referencedNote: 'Note 18', referencedTopic: 'Related Party Transactions', result: 'Reference Valid', status: 'Complete', completed: false },
  { id: 4, statement: 'Income Statement \u2014 Depreciation', referencedNote: 'Note 9', referencedTopic: 'Property, Plant & Equipment', result: 'Reference Valid', status: 'Complete', completed: false },
  { id: 5, statement: 'Equity Statement \u2014 Capital Reduction', referencedNote: 'Note 15', referencedTopic: 'Share Capital', result: 'Reference Valid', status: 'Complete', completed: false },
  { id: 6, statement: 'Cash Flow \u2014 Investing Activities', referencedNote: 'Note 22', referencedTopic: '\u2014', result: 'Referenced Note Not Found', status: 'Flagged', issue: 'Note 22 does not exist in the disclosure package. The referenced note cannot be located.', completed: false },
];

const MOCK_FOOTINGS: FootingRow[] = [
  { id: 0, table: 'Revenue Note (Note 4)', location: 'Disclosure Note', reportedTotal: 'SAR 285,000', calculatedTotal: 'SAR 285,000', difference: '\u2014', result: 'Pass', status: 'Complete', completed: false },
  { id: 1, table: 'Current Assets Subtotal', location: 'Balance Sheet', reportedTotal: 'SAR 198,400', calculatedTotal: 'SAR 201,200', difference: 'SAR 2,800', result: 'Subfooting Exception', status: 'Flagged', exceptionType: 'Subfooting Exception', completed: false },
  { id: 2, table: 'Total Assets', location: 'Balance Sheet', reportedTotal: 'SAR 412,600', calculatedTotal: 'SAR 412,600', difference: '\u2014', result: 'Pass', status: 'Complete', completed: false },
  { id: 3, table: 'Total Liabilities & Equity', location: 'Balance Sheet', reportedTotal: 'SAR 412,600', calculatedTotal: 'SAR 412,600', difference: '\u2014', result: 'Pass', status: 'Complete', completed: false },
  { id: 4, table: 'Gross Profit', location: 'Income Statement', reportedTotal: 'SAR 117,000', calculatedTotal: 'SAR 117,000', difference: '\u2014', result: 'Pass', status: 'Complete', completed: false },
  { id: 5, table: 'Operating Activities Total', location: 'Cash Flow Statement', reportedTotal: 'SAR 84,200', calculatedTotal: 'SAR 81,900', difference: 'SAR 2,300', result: 'Footing Exception', status: 'Flagged', exceptionType: 'Footing Exception', completed: false },
  { id: 6, table: 'Changes in Equity Total', location: 'Equity Statement', reportedTotal: 'SAR 253,800', calculatedTotal: 'SAR 253,800', difference: '\u2014', result: 'Pass', status: 'Complete', completed: false },
];

@Injectable({ providedIn: 'root' })
export class IntegrityService {
  private readonly xrefState = signal<XRefRow[]>(structuredClone(MOCK_XREFS));
  private readonly footingState = signal<FootingRow[]>(structuredClone(MOCK_FOOTINGS));

  readonly xrefRows = this.xrefState.asReadonly();
  readonly footingRows = this.footingState.asReadonly();

  private mockDelay() {
    return environment.useMockData ? 250 : 0;
  }

  /** Simulates GET {apiUrl}/integrity/cross-references */
  getXRefRows(): Observable<XRefRow[]> {
    return of(this.xrefState()).pipe(delay(this.mockDelay()));
  }

  /** Simulates POST {apiUrl}/integrity/cross-references/{id}/complete */
  markXRefComplete(id: number): Observable<XRefRow> {
    const updated = this.xrefState().map((r) => (r.id === id ? { ...r, completed: true, status: 'Complete' as const } : r));
    return of(updated.find((r) => r.id === id)!).pipe(
      delay(this.mockDelay()),
      tap(() => this.xrefState.set(updated)),
    );
  }

  /** Simulates GET {apiUrl}/integrity/footings */
  getFootingRows(): Observable<FootingRow[]> {
    return of(this.footingState()).pipe(delay(this.mockDelay()));
  }

  /** Simulates POST {apiUrl}/integrity/footings/{id}/complete */
  markFootingComplete(id: number): Observable<FootingRow> {
    const updated = this.footingState().map((r) => (r.id === id ? { ...r, completed: true, status: 'Complete' as const } : r));
    return of(updated.find((r) => r.id === id)!).pipe(
      delay(this.mockDelay()),
      tap(() => this.footingState.set(updated)),
    );
  }
}
