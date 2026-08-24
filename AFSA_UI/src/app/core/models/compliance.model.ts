/** Generic envelope every compliance-monitoring endpoint responds with. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: string[];
}

/** GET /compliance-monitoring/notes */
export interface ComplianceNoteSummary {
  noteId: string;
  title: string;
  noteCode: string;
  noteNumber: number;
}

export interface ComplianceNotesResponse {
  period: string;
  priorityRequirementsCount: number;
  notes: ComplianceNoteSummary[];
}

/** GET /compliance-monitoring/notes/{noteId}/schema */
export interface TableColumn {
  key: string;
  label: string;
}

export interface NoteTableSchema {
  id: string;
  name: string;
  tableColumns: TableColumn[];
}

export interface NoteSchema {
  noteId: string;
  standard: string;
  standardCode: string;
  currency: string;
  tables: NoteTableSchema[];
}

/** GET /compliance-monitoring/notes/{noteId}/data */
export type TableCellValue = string | number | null;

export interface NoteTableData {
  noteId: string;
  tableId: string;
  tableName: string;
  tableColumns: TableColumn[];
  items: Record<string, TableCellValue>[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  resultCount: number;
  totalPages: number;
}

/** GET /compliance-monitoring/notes/{noteId}/narrative */
export interface NoteNarrative {
  noteId: string;
  narrative: string;
}

/** POST /compliance-monitoring/notes/{noteId}/compliance-check */
export type RequirementStatus = 'Met' | 'Partial' | 'Missing';

export interface ComplianceRequirementResult {
  reqId: string;
  requirement: string;
  evidenceType: string;
  status: RequirementStatus;
  isMet: boolean;
  gap: string | null;
  evidence: string | null;
  error: string | null;
}

export interface ComplianceCheckResult {
  noteId: string;
  noteTitle: string;
  standardCode: string;
  standardLabel: string;
  requirementsMet: number;
  requirementsTotal: number;
  complianceConfidence: number;
  summary: string;
  requirementsAssessed: number;
  requirementsFailedToAssess: number;
  results: ComplianceRequirementResult[];
}
