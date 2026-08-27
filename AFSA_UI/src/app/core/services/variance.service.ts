import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  FinancialInsightsApiResponse,
  ManagementReportData,
  ReadinessItem,
  VarianceAnalysisData,
  VarianceApiRow,
  VarianceRow,
} from '../models/variance.model';

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

/** How often to poll the GET status endpoints while an analysis/report is running. */
const POLL_INTERVAL_MS = 5000;

const SUBTOTAL_LINE_ITEMS = new Set(['gross profit', 'operating profit', 'net profit', 'total assets', 'total liabilities', 'total equity']);

/** UI select shows "Q1 2026" — the API wants "2026Q1". */
export function toApiPeriod(label: string): string | null {
  const match = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!match) return null;
  const [, quarter, year] = match;
  return `${year}Q${quarter}`;
}

/** API returns "2026Q1" — the UI displays "Q1 2026". */
export function fromApiPeriod(apiPeriod: string): string {
  const match = apiPeriod.trim().match(/^(\d{4})Q([1-4])$/i);
  if (!match) return apiPeriod;
  const [, year, quarter] = match;
  return `Q${quarter} ${year}`;
}

function formatVarPct(row: VarianceApiRow): string {
  if (row.variance_pct === null || row.comparison_value_sar_thousands === 0) return 'N/A';
  const sign = row.variance_pct >= 0 ? '+' : '';
  return `${sign}${row.variance_pct.toFixed(1)}%`;
}

/** Maps one Financial Insights API row onto the table's existing UI-row shape. */
export function mapApiRowToVarianceRow(row: VarianceApiRow): VarianceRow {
  return {
    item: row.line_item,
    current: row.current_value_sar_thousands,
    comparison: row.comparison_value_sar_thousands,
    variance: row.variance_sar_thousands,
    varPct: formatVarPct(row),
    analysis: row.analysis,
    color: row.color,
    isSubtotal: SUBTOTAL_LINE_ITEMS.has(row.line_item.trim().toLowerCase()),
  };
}

@Injectable({ providedIn: 'root' })
export class VarianceService {
  private readonly base = environment.financialInsightsApiUrl;

  constructor(private readonly http: HttpClient) {}

  /* =========================================================================
   * Group Variance Analysis — POST /group-variance-analysis, GET .../{id}
   * ======================================================================= */

  /** POST /group-variance-analysis — table rows come back immediately, analysis: null per row. */
  startVarianceAnalysis(targetPeriod: string, comparisonPeriod: string): Observable<VarianceAnalysisData> {
    return this.http
      .post<FinancialInsightsApiResponse<VarianceAnalysisData>>(`${this.base}/group-variance-analysis`, {
        target_period: targetPeriod,
        comparison_period: comparisonPeriod,
      })
      .pipe(map((res) => res.data));
  }

  /** GET /group-variance-analysis/{id} — one status check. */
  getVarianceAnalysisStatus(analysisId: string): Observable<VarianceAnalysisData> {
    return this.http
      .get<FinancialInsightsApiResponse<VarianceAnalysisData>>(`${this.base}/group-variance-analysis/${analysisId}`)
      .pipe(map((res) => res.data));
  }

  /**
   * Polls GET /group-variance-analysis/{id} every POLL_INTERVAL_MS until the
   * per-row Gemini commentary is fully populated (status "ready") or the job
   * fails, emitting each intermediate snapshot along the way so the caller
   * can update the table's "Analyzing…" cells as they resolve.
   */
  pollVarianceAnalysis(analysisId: string): Observable<VarianceAnalysisData> {
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap(() => this.getVarianceAnalysisStatus(analysisId)),
      takeWhile((data) => data.status === 'queued' || data.status === 'running', true),
    );
  }

  /* =========================================================================
   * Management Report PPTX — POST /management-reports, GET .../{id}
   * ======================================================================= */

  startManagementReport(targetPeriod: string): Observable<ManagementReportData> {
    return this.http
      .post<FinancialInsightsApiResponse<ManagementReportData>>(`${this.base}/management-reports`, {
        target_period: targetPeriod,
      })
      .pipe(map((res) => res.data));
  }

  getManagementReportStatus(reportId: string): Observable<ManagementReportData> {
    return this.http
      .get<FinancialInsightsApiResponse<ManagementReportData>>(`${this.base}/management-reports/${reportId}`)
      .pipe(map((res) => res.data));
  }

  /**
   * Polls GET /management-reports/{id} every POLL_INTERVAL_MS until the
   * PPTX is ready (with a fresh download_url, valid ~15 minutes) or the
   * job fails.
   */
  pollManagementReport(reportId: string): Observable<ManagementReportData> {
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap(() => this.getManagementReportStatus(reportId)),
      takeWhile((data) => data.status === 'queued' || data.status === 'running', true),
    );
  }


}
