export type Affiliate = 'A' | 'B';

export type FindingStatus = 'Open' | 'Investigate' | 'Closed';

export type MappingStatus = 'High Confidence' | 'Low Confidence' | 'Unmapped';

export interface Finding {
  accountCode: string;
  account: string;
  currentPeriod: string;
  priorPeriod: string;
  change: string;
  flag: string;
  flagColumn: 'current' | 'change';
  severity: 'High' | 'Medium';
  status: FindingStatus;
}

export interface CoaRow {
  code: string;
  description: string;
  originalStatus: MappingStatus;
  selectedMapping: string;
  confirmed: boolean;
}

export type ChecklistStatus = 'Complete' | 'Incomplete' | 'Missing' | 'Not Applicable';

export interface ChecklistItem {
  label: string;
  file: string;
  status: ChecklistStatus;
}

export interface ChecklistGroup {
  group: string;
  items: ChecklistItem[];
}

export type UploadPhase = 'idle' | 'uploading' | 'done' | 'error';

export interface UploadState {
  phase: UploadPhase;
  progress: number;
  filename: string;
}

export interface UploadProgressEvent {
  progress: number;
  done: boolean;
}
