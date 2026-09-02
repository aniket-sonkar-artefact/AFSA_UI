import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  FinancialInsightsApiResponse,
  ManagementReportData,
  ReadinessItem,
  StatementType,
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

/** How often to poll the GET status endpoint while a management report is running. */
const POLL_INTERVAL_MS = 5000;

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

function formatVarPct(pct: number | null): string {
  if (pct === null) return 'N/A';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/** No explicit color field exists on the real API row -- direction is
 *  derived from the sign of variance_pct instead. */
function varianceColor(pct: number | null): 'green' | 'red' | 'neutral' {
  if (pct === null || pct === 0) return 'neutral';
  return pct > 0 ? 'green' : 'red';
}

/** Maps one API row onto the table's UI-row shape (depth applied separately
 *  by buildRowHierarchy). */
export function mapApiRowToVarianceRow(row: VarianceApiRow, depth = 0): VarianceRow {
  return {
    rowId: row.row_id,
    parentRowId: row.parent_row_id,
    rowType: row.row_type,
    item: row.label,
    noteReference: row.note_reference,
    isExpandable: row.is_expandable,
    depth,
    current: row.current_value_sar_thousands,
    comparison: row.comparison_value_sar_thousands,
    variance: row.variance_sar_thousands,
    varPct: formatVarPct(row.variance_pct),
    color: varianceColor(row.variance_pct),
    analysis: row.analysis,
    isSubtotal: row.row_type === 'subtotal' || row.row_type === 'total',
  };
}

/**
 * Flattens the API's parent_row_id tree into document order (each parent
 * immediately followed by its own children, depth-first), computing an
 * indentation depth along the way. The table renders this as a single flat
 * list; expand/collapse then hides a row's descendants by filtering this
 * same flattened order (see StatementsComponent.visibleRows).
 */
export function buildRowHierarchy(apiRows: VarianceApiRow[]): VarianceRow[] {
  const sorted = [...apiRows].sort((a, b) => a.display_order - b.display_order);
  const byParent = new Map<string | null, VarianceApiRow[]>();
  for (const row of sorted) {
    const key = row.parent_row_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(row);
  }

  const result: VarianceRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const child of byParent.get(parentId) ?? []) {
      result.push(mapApiRowToVarianceRow(child, depth));
      walk(child.row_id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}

@Injectable({ providedIn: 'root' })
export class VarianceService {
  private readonly base = environment.financialInsightsApiUrl;

  constructor(private readonly http: HttpClient) {}

  /* =========================================================================
   * Group Variance Analysis — POST /group-variance-analysis
   * Synchronous: the full row tree (with commentary) comes back in the same
   * response body, so there is no separate GET/poll step for this endpoint.
   * ======================================================================= */

  getVarianceAnalysis(
    statementType: StatementType,
    targetPeriod: string,
    comparisonPeriod: string,
  ): Observable<VarianceAnalysisData> {
    return this.http
      .post<FinancialInsightsApiResponse<VarianceAnalysisData>>(`${this.base}/group-variance-analysis`, {
        statement_type: statementType,
        target_period: targetPeriod,
        comparison_period: comparisonPeriod,
      })
      .pipe(map((res) => res.data));
  }

  /* =========================================================================
   * Management Report PPTX — POST /management-reports, GET .../{id}
   * (unrelated endpoint, unchanged)
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

  pollManagementReport(reportId: string): Observable<ManagementReportData> {
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap(() => this.getManagementReportStatus(reportId)),
      takeWhile((data) => data.status === 'queued' || data.status === 'running', true),
    );
  }
}