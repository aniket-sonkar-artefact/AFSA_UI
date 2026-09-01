export type FindingStatus = 'Open' | 'Investigate' | 'Closed';

export type MappingStatus = 'High Confidence' | 'Low Confidence' | 'Unmapped' | string;
export type ReviewStatus = 'Confirmed' | 'Resolved' | 'Pending' | string;

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
  monthValue: string;
  qtdValue: string;
  ytdValue: string;
  currentGroupNode: string | null;
  selectedMapping: string;
  mappingConfidence: MappingStatus;
  status: ReviewStatus;
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
    units?: string;
  };
  counts: {
    accountsReviewed: number;
    highConfidence: number;
    lowConfidencePending: number;
    unmappedPending: number;
    confirmed: number;
    resolved: number;
    pending: number;
    mappingsConfirmed: number;
    flagged: number;
  };
}

export interface CoaSchemaColumn {
  key: string;
  label: string;
  type: string;
  optionsFrom?: string;
  valueKey?: string;
  placeholder?: string;
  actionLabel?: string;
  enabledKey?: string;
}

export interface CoaSchemaVocabulary<T extends string = string> {
  value: T;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

export interface CoaSchema {
  tableColumns: CoaSchemaColumn[];
  mappingConfidences: CoaSchemaVocabulary<MappingStatus>[];
  reviewStatuses: CoaSchemaVocabulary<ReviewStatus>[];
  units: string;
  period: string;
  groupNodes: CoaGroupNode[];
  groupNodeCount: number;
  nodesSource?: string;
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