export interface NoteCheckResult {
  confidence: number;
  summary: string;
}

export interface IfrsNote {
  id: number;
  title: string;
  standard: string;
  tableHeaders: string[];
  tableRows: string[][];
  defaultNarrative: string;
  checkResults: NoteCheckResult[];
}

export type CheckState = 'idle' | 'checking' | 'done';
