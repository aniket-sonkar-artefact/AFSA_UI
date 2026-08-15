export type XRefResult =
  | 'Reference Valid'
  | 'Reference Mismatch'
  | 'Missing Reference'
  | 'Referenced Note Not Found';

export interface XRefRow {
  id: number;
  statement: string;
  referencedNote: string;
  referencedTopic: string;
  result: XRefResult;
  status: 'Complete' | 'Flagged';
  issue?: string;
  completed: boolean;
}

export type FootingResult = 'Pass' | 'Footing Exception' | 'Subfooting Exception';

export interface FootingRow {
  id: number;
  table: string;
  location: string;
  reportedTotal: string;
  calculatedTotal: string;
  difference: string;
  result: FootingResult;
  status: 'Complete' | 'Flagged';
  exceptionType?: 'Footing Exception' | 'Subfooting Exception';
  completed: boolean;
}
