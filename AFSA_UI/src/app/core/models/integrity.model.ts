/** Generic envelope every statement-validation/integrity-check endpoint responds with. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: { code: string; field: string | null; message: string }[];
}

/* ---------------------------------------------------------------------- */
/* GET /summary                                                           */
/* ---------------------------------------------------------------------- */

export interface IntegrityDocument {
  entity: string;
  periodLabel: string;
  reviewStatus: string;
  currency: string;
  unit: string;
  source: string;
}

export interface IntegrityCheckCounts {
  checked: number;
  passed: number;
  flagged: number;
  completed: number;
}

export interface IntegritySummary {
  document: IntegrityDocument;
  checks: {
    crossReference: IntegrityCheckCounts;
    footing: IntegrityCheckCounts;
  };
  totalFlagged: number;
  totalFlaggedByAgent: number;
}

/* ---------------------------------------------------------------------- */
/* GET /cross-reference/schema · GET /footing/schema                      */
/* ---------------------------------------------------------------------- */

export type ColumnType = 'text' | 'money' | 'badge' | 'link' | 'action';

export interface TableColumn {
  key: string;
  label: string;
  type: ColumnType;
  targetKey?: string;
  actionLabel?: string;
  enabledKey?: string;
}

export interface BadgeVocabEntry {
  value: string;
  tone: 'success' | 'danger' | 'warning' | string;
}

export interface CountCardDef {
  key: 'checked' | 'passed' | 'flagged' | 'completed';
  label: string;
}

export type CheckId = 'crossReference' | 'footing';

export interface IntegrityTableSchema {
  checkId: CheckId;
  title: string;
  tableColumns: TableColumn[];
  checkResults: BadgeVocabEntry[];
  statuses: BadgeVocabEntry[];
  countCards: CountCardDef[];
}

/* ---------------------------------------------------------------------- */
/* GET /cross-reference                                                   */
/* ---------------------------------------------------------------------- */

export interface XRefRow {
  lineId: string;
  statementLocation: string;
  referencedNote: string;
  referencedNoteNumber: number | null;
  referencedTopic: string;
  checkResult: 'Reference Valid' | 'Reference Mismatch' | 'Referenced Note Not Found' | string;
  status: 'Complete' | 'Flagged' | string;
  issueIdentified: string;
  canComplete: boolean;
}

/* ---------------------------------------------------------------------- */
/* GET /footing                                                           */
/* ---------------------------------------------------------------------- */

export interface FootingRow {
  lineId: string;
  tableSection: string;
  location: 'Income Statement' | 'Balance Sheet' | 'Disclosure Note' | string;
  reportedTotal: number;
  calculatedTotal: number;
  difference: number | null;
  result: 'Pass' | 'Subfooting Exception' | 'Footing Exception' | string;
  status: 'Complete' | 'Flagged' | string;
  issueIdentified: string;
  canComplete: boolean;
}

/** Shared paginated envelope shape for the two table routes. */
export interface IntegrityTablePage<T> {
  counts: IntegrityCheckCounts;
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  resultCount: number;
  totalPages: number;
}

export interface FootingTablePage extends IntegrityTablePage<FootingRow> {
  unmappedSubtotals: string[];
}

/* ---------------------------------------------------------------------- */
/* POST /mark-complete                                                    */
/* ---------------------------------------------------------------------- */

export interface MarkCompleteRequest {
  checkId: CheckId;
  lineId: string;
  complete?: boolean;
}

export interface MarkCompleteResponse<T = XRefRow | FootingRow> {
  row: T;
  counts: IntegrityCheckCounts;
  persisted: boolean;
}
