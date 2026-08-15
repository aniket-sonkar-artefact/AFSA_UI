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
  download?: boolean;
}
