export type StatementType = 'income_statement' | 'balance_sheet';
export type RowType = 'group' | 'line_item' | 'subtotal' | 'total';

/** One row as returned by the group-variance-analysis endpoint. */
export interface VarianceApiRow {
  row_id: string;
  parent_row_id: string | null;
  row_type: RowType;
  display_order: number;
  label: string;
  note_reference: string | null;
  is_expandable: boolean;
  current_value_sar_thousands: number;
  comparison_value_sar_thousands: number;
  variance_sar_thousands: number;
  variance_pct: number | null;
  analysis: string | null;
}

/** Synchronous response — the full row tree, including commentary, comes
 *  back in the same call. No analysis_id/status/polling for this endpoint. */
export interface VarianceAnalysisData {
  statement_type: StatementType;
  target_period: string;
  comparison_period: string;
  currency: string;
  unit: string;
  rows: VarianceApiRow[];
}

export interface StartVarianceAnalysisRequest {
  statement_type: StatementType;
  target_period: string;
  comparison_period: string;
}

/** UI-shape row, flattened from the API's parent/child tree with a computed
 *  indentation depth so the table can render it as a single flat list while
 *  still supporting nested expand/collapse (see buildRowHierarchy). */
export interface VarianceRow {
  rowId: string;
  parentRowId: string | null;
  rowType: RowType;
  item: string;
  noteReference: string | null;
  isExpandable: boolean;
  depth: number;
  current: number;
  comparison: number;
  variance: number;
  varPct: string;
  color: 'green' | 'red' | 'neutral';
  analysis: string | null;
  /** True for 'subtotal' and 'total' rows — kept as a boolean for the
   *  template's existing bold/shaded-row styling. */
  isSubtotal: boolean;
}

/** Standard envelope every Financial Insights endpoint responds with. */
export interface FinancialInsightsApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: { code: string; message: string }[];
}

export type ManagementReportApiStatus = 'queued' | 'running' | 'ready' | 'failed';

export interface ManagementReportData {
  report_id: string;
  status: ManagementReportApiStatus;
  status_url?: string;
  download_url?: string;
  expires_at?: string;
  error?: string;
}

export interface VarianceFilters {
  period: string;
  comparison: string;
  entity: string;
  currency: string;
}

export type WorkspaceTab = 'variance' | 'management';

export type ManagementReportState = 'idle' | 'generating' | 'ready';

export interface ReadinessItem {
  label: string;
  detail: string;
}