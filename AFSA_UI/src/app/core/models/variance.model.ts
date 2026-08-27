export interface VarianceRow {
  item: string;
  current: number;
  comparison: number;
  variance: number;
  varPct: string;
  color: string;
  analysis: string | null;
  isSubtotal?: boolean;
}

/** Standard envelope every Financial Insights endpoint responds with. */
export interface FinancialInsightsApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: { code: string; message: string }[];
}

export type AnalysisStatus = 'queued' | 'running' | 'ready' | 'failed';

/** One row as returned by the group-variance-analysis endpoints. */
export interface VarianceApiRow {
  statement: string;
  line_item: string;
  current_value_sar_thousands: number;
  comparison_value_sar_thousands: number;
  variance_sar_thousands: number;
  variance_pct: number | null;
  analysis: string | null;
  color: string;
}

export interface VarianceAnalysisData {
  analysis_id: string;
  status: AnalysisStatus;
  status_url?: string;
  target_period: string;
  comparison_period: string;
  currency: string;
  unit: string;
  rows: VarianceApiRow[];
  error?: string;
}

export interface StartVarianceAnalysisRequest {
  target_period: string;
  comparison_period: string;
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




