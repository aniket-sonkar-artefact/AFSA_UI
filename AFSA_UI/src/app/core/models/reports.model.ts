export type ReportCapability =
  | 'Affiliate Submission Review'
  | 'Compliance Monitoring & Benchmarking'
  | 'Management Reports & Variance Analysis'
  | 'Financial Statement Integrity Check';

export interface ReportRow {
  id: string;
  title: string;
  capability: ReportCapability;
  meta: string;
  reportType: string;
  download?: boolean;
}

/** Standard envelope every reporting endpoint responds with. */
export interface ReportsApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: { code: string; message: string }[];
}

export type DocxReportStatus = 'queued' | 'running' | 'ready' | 'failed';

export interface DocxReportGeneration {
  generation_id: string;
  report_type: string;
  target_period?: string;
  status: DocxReportStatus;
  status_url?: string;
  download_url?: string;
  error?: string;
}

export interface StartDocxReportRequest {
  report_type: string;
  target_period?: string;
}
