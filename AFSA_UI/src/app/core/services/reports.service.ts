import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  DocxReportGeneration,
  ReportRow,
  ReportsApiResponse,
} from '../models/reports.model';

const REPORTS: ReportRow[] = [
  { id: 'completeness', title: 'Completeness Checklist', capability: 'Affiliate Submission Review', meta: 'Group \u00b7 Q1 2026', reportType: 'completeness_checklist' },
  { id: 'irregularities', title: 'Irregularities Report', capability: 'Affiliate Submission Review', meta: 'Group \u00b7 Q1 2026', reportType: 'irregularities_report' },
  { id: 'coa', title: 'CoA Mapping Report', capability: 'Affiliate Submission Review', meta: 'Group \u00b7 Q1 2026', reportType: 'coa_mapping_report' },
  { id: 'ifrs', title: 'IFRS Requirements Compliance Report', capability: 'Compliance Monitoring & Benchmarking', meta: 'Group \u00b7 Q1 2026', reportType: 'ifrs_requirements_compliance' },
  { id: 'variance', title: 'Variance Analysis Report', capability: 'Management Reports & Variance Analysis', meta: 'Group Consolidated \u00b7 Q1 2026', reportType: 'group_variance_analysis' },
  { id: 'integrity', title: 'Footings and Cross-References Exception Report', capability: 'Financial Statement Integrity Check', meta: 'Group \u00b7 Q1 2026', reportType: 'footings_cross_references_exception' },
];

/** How often to poll GET /api/v1/reports/{generation_id} while a job runs. */
const POLL_INTERVAL_MS = 5000;

/** UI meta strings look like "Group · Q1 2026" — the API wants "2026Q1". */
export function targetPeriodFromMeta(meta: string): string | undefined {
  const match = meta.match(/Q([1-4])\s+(\d{4})/i);
  if (!match) return undefined;
  const [, quarter, year] = match;
  return `${year}Q${quarter}`;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly base = environment.docxReportsApiUrl;

  constructor(private readonly http: HttpClient) {}

  /** Static report catalog for the screen (no list endpoint on the backend). */
  getReports(): Observable<ReportRow[]> {
    return of(REPORTS);
  }

  /** POST /api/v1/reports — starts DOCX generation for a report_type. */
  startReportGeneration(reportType: string, targetPeriod?: string): Observable<DocxReportGeneration> {
    const body: { report_type: string; target_period?: string } = { report_type: reportType };
    if (targetPeriod) body.target_period = targetPeriod;

    return this.http
      .post<ReportsApiResponse<DocxReportGeneration>>(`${this.base}/reports`, body)
      .pipe(map((res) => res.data));
  }

  /** GET /api/v1/reports/{generation_id} — one status check. */
  getReportStatus(generationId: string): Observable<DocxReportGeneration> {
    return this.http
      .get<ReportsApiResponse<DocxReportGeneration>>(`${this.base}/reports/${generationId}`)
      .pipe(map((res) => res.data));
  }

  /**
   * Polls GET /api/v1/reports/{generation_id} every POLL_INTERVAL_MS until
   * the DOCX is ready (with a download_url) or the job fails.
   */
  pollReportStatus(generationId: string): Observable<DocxReportGeneration> {
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap(() => this.getReportStatus(generationId)),
      takeWhile((data) => data.status === 'queued' || data.status === 'running', true),
    );
  }

  /**
   * Full flow used by the "Generate Report" button: start generation, then
   * poll until the job is ready or fails, emitting each intermediate status
   * along the way.
   */
  generateReport(reportType: string, targetPeriod?: string): Observable<DocxReportGeneration> {
    return this.startReportGeneration(reportType, targetPeriod).pipe(
      switchMap((started) => this.pollReportStatus(started.generation_id)),
    );
  }
}
