export interface VarianceRow {
  item: string;
  current: number;
  comparison: number;
  variance: number;
  varPct: string;
  analysis: string;
  isSubtotal?: boolean;
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

export interface GenerationHistoryRow {
  period: string;
  fileName: string;
  date: string;
  status: 'Current' | 'Previous';
}

/** Shape mirrors an HttpClient reportProgress event, so swapping the mock
 *  service method for a real generation endpoint later is mechanical. */
export interface GenerationStepEvent {
  stepIndex: number;
  stepLabel: string;
  done: boolean;
}
