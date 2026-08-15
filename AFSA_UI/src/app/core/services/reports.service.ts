import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ReportRow } from '../models/reports.model';

const MOCK_REPORTS: ReportRow[] = [
  { id: 'completeness', title: 'Completeness Checklist', capability: 'Affiliate Submission Review', meta: 'Group \u00b7 Q1 2026' },
  { id: 'irregularities', title: 'Irregularities Report', capability: 'Affiliate Submission Review', meta: 'Group \u00b7 Q1 2026' },
  { id: 'coa', title: 'CoA Mapping Report', capability: 'Affiliate Submission Review', meta: 'Group \u00b7 Q1 2026' },
  { id: 'ifrs', title: 'IFRS Requirements Compliance Report', capability: 'Compliance Monitoring & Benchmarking', meta: 'Group \u00b7 Q1 2026' },
  { id: 'variance', title: 'Variance Analysis Report', capability: 'Management Reports & Variance Analysis', meta: 'Group Consolidated \u00b7 Q1 2026' },
  { id: 'management', title: 'Management Report', capability: 'Management Reports & Variance Analysis', meta: 'Group Consolidated \u00b7 Q1 2026', download: true },
  { id: 'integrity', title: 'Footings and Cross-References Exception Report', capability: 'Financial Statement Integrity Check', meta: 'Group \u00b7 Q1 2026' },
];

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private mockDelay() {
    return environment.useMockData ? 250 : 0;
  }

  /** Simulates GET {apiUrl}/reports */
  getReports(): Observable<ReportRow[]> {
    return of(MOCK_REPORTS).pipe(delay(this.mockDelay()));
  }

  /** Simulates POST {apiUrl}/reports/{id}/generate */
  generateReport(id: string): Observable<{ id: string; generatedAt: string }> {
    return of({ id, generatedAt: new Date().toISOString() }).pipe(delay(this.mockDelay()));
  }
}
