export type FindingStatus = 'Open' | 'Investigate' | 'Closed';

export type MappingStatus = 'High Confidence' | 'Low Confidence' | 'Unmapped';

export interface FinanceAffiliate {
  entityCode: string;
  entityName: string;
}

export interface CoaAffiliate {
  key: string;
  name: string;
  isDefault: boolean;
}

export interface Finding {
  accountCode: string;
  account: string;
  currentPeriod: string;
  priorPeriod: string;
  change: string;
  flag: string;
  severityColor: 'red' | 'yellow';
  colorLocation: 'currentPeriod' | 'change';
  status: FindingStatus;
}

export interface IrregularitiesPage {
  items: Finding[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  resultCount: number;
  totalPages: number;
}

export interface IrregularitiesSummary {
  totalIrregularities: number;
  highPriorityOpen: number;
  underInvestigation: number;
  closed: number;
}

export interface ChecklistItem {
  label: string;
  file: string;
  status: ChecklistStatus;
  statusReason: string | null;
}

export interface ChecklistGroup {
  group: string;
  items: ChecklistItem[];
}

export type ChecklistStatus = 'Complete' | 'Incomplete' | 'Missing' | 'Not Applicable';

export interface CoaGroupNode {
  code: string;
  name: string;
  category: string;
  label: string;
}

export interface CoaRow {
  rowId: string;
  code: string;
  description: string;
  currentGroupNode: string | null;
  selectedMapping: string;
  mappingStatus: MappingStatus;
  rationale: string;
  canConfirm: boolean;
  confirmed: boolean;
  pendingSelection: string | null;
}

export interface CoaPage {
  items: CoaRow[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  resultCount: number;
  totalPages: number;
}

export interface CoaSummary {
  session: {
    entity: string;
    affiliate: string;
    affiliateName: string;
    affiliateCode: string;
    periodLabel: string;
    reviewStatus: string;
    reviewer: string;
    highConfidenceThreshold: number;
  };
  counts: {
    accountsReviewed: number;
    mappingsConfirmed: number;
    lowConfidencePending: number;
    unmappedPending: number;
    highConfidence: number;
    flagged: number;
  };
}

export interface CoaSchema {
  tableColumns: Array<{
    key: string;
    label: string;
    type: string;
    optionsFrom?: string;
    valueKey?: string;
    placeholder?: string;
    actionLabel?: string;
    enabledKey?: string;
  }>;
  mappingStatuses: Array<{ value: MappingStatus; label: string; tone: 'success' | 'warning' | 'danger' }>;
  groupNodes: CoaGroupNode[];
  groupNodeCount: number;
  highConfidenceThreshold: number;
}

export interface UploadProgressEvent {
  progress: number;
  done: boolean;
}

export type UploadPhase = 'idle' | 'uploading' | 'done' | 'error';

export interface UploadState {
  phase: UploadPhase;
  progress: number;
  filename: string;
}