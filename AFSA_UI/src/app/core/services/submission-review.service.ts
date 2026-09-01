import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChecklistGroup,
  ChecklistStatus,
  CoaAffiliate,
  CoaPage,
  CoaRow,
  CoaSchema,
  CoaSummary,
  FinanceAffiliate,
  Finding,
  FindingStatus,
  IrregularitiesPage,
  IrregularitiesSummary,
  MappingStatus,
  ReviewStatus,
  UploadProgressEvent,
} from '../models/submission-review.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: { code: string; field?: string; message: string }[];
}

interface ApiChecklistItem {
  submissionItem: string;
  submittedFile: string | null;
  status: string;
  statusReason: string | null;
}

interface ApiChecklistGroup {
  name: string;
  items: ApiChecklistItem[];
}

interface ApiFinding {
  accountCode: string;
  account: string;
  currentPeriod: number | null;
  priorPeriod: number | null;
  change: string;
  flag: string;
  status: string;
  severityColor: 'red' | 'yellow';
  colorLocation: 'currentPeriod' | 'change';
}

interface ApiIrregularitiesPage {
  items: ApiFinding[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  resultCount: number;
  totalPages: number;
}

interface ApiCoaAffiliate {
  key: string;
  name: string;
  isDefault: boolean;
}

interface ApiCoaRow {
  rowId: string;
  affiliateAccount: string;
  description: string;
  monthValue: string;
  qtdValue: string;
  ytdValue: string;
  currentGroupNode: string | null;
  currentGroupMapping: string;
  mappingConfidence: MappingStatus;
  status: ReviewStatus;
  rationale: string;
  canConfirm: boolean;
}

interface ApiCoaPage {
  items: ApiCoaRow[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  resultCount: number;
  totalPages: number;
}

interface ApiConfirmResponse {
  row: ApiCoaRow;
  counts: CoaSummary['counts'] | null;
  confirmed: boolean;
  persisted: boolean;
}

const PERIOD_KEY = '2026Q1';
const IRREGULARITIES_PAGE_SIZE = 10;
const COA_PAGE_SIZE = 10;

function toChecklistStatus(status: string): ChecklistStatus {
  switch (status.toUpperCase()) {
    case 'COMPLETE': return 'Complete';
    case 'INCOMPLETE': return 'Incomplete';
    case 'NOT_APPLICABLE': return 'Not Applicable';
    default: return 'Missing';
  }
}

function toFindingStatus(status: string): FindingStatus {
  if (status === 'Investigate') return 'Investigate';
  if (status === 'Closed') return 'Closed';
  return 'Open';
}

function formatPeriodValue(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('en-US');
}

function mapFinding(row: ApiFinding): Finding {
  return {
    accountCode: row.accountCode,
    account: row.account,
    currentPeriod: formatPeriodValue(row.currentPeriod),
    priorPeriod: formatPeriodValue(row.priorPeriod),
    change: row.change,
    flag: row.flag,
    severityColor: row.severityColor,
    colorLocation: row.colorLocation,
    status: toFindingStatus(row.status),
  };
}

@Injectable({ providedIn: 'root' })
export class SubmissionReviewService {
  private readonly financeBase = environment.affiliateSubmissionApiUrl;
  private readonly coaBase = `${environment.coaMappingApiUrl}/affiliate-review/coa-mapping`;

  constructor(private readonly http: HttpClient) {}

  getFinanceAffiliates(): Observable<FinanceAffiliate[]> {
    return this.http.get<ApiResponse<FinanceAffiliate[]>>(`${this.financeBase}/affiliates`).pipe(map((response) => response.data));
  }

  getCoaAffiliates(): Observable<CoaAffiliate[]> {
    return this.http
      .get<ApiResponse<{ items: ApiCoaAffiliate[]; defaultAffiliate: string }>>(`${this.coaBase}/affiliates`)
      .pipe(map((response) => response.data.items));
  }

  getChecklist(entityCode: string, periodKey = PERIOD_KEY): Observable<ChecklistGroup[]> {
    const params = new HttpParams().set('period_key', periodKey);
    return this.http
      .get<ApiResponse<{ sections: ApiChecklistGroup[] }>>(`${this.financeBase}/affiliate-submission-review/${encodeURIComponent(entityCode)}/completeness-review`, { params })
      .pipe(map((response) => response.data.sections.map((section) => ({
        group: section.name,
        items: section.items.map((item) => ({
          label: item.submissionItem,
          file: item.submittedFile ?? '—',
          status: toChecklistStatus(item.status),
          statusReason: item.statusReason,
        })),
      }))));
  }

  uploadChecklistFile(
    entityCode: string,
    submissionItem: string,
    file: File,
    periodKey = PERIOD_KEY
  ): Observable<UploadProgressEvent> {
    const params = new HttpParams().set('period_key', periodKey);
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http
      .post<ApiResponse<{ submissionItem: string; submittedFile: string | null; status: string; statusReason: string | null }>>(
        `${this.financeBase}/affiliate-submission-review/${encodeURIComponent(entityCode)}/completeness-review/${encodeURIComponent(submissionItem)}/file`,
        formData, 
        { params, observe: 'events', reportProgress: true },
      )
      .pipe(
        map((event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          return { progress, done: false };
        }
        if (event.type === HttpEventType.Response) return { progress: 100, done: true };
        return { progress: 0, done: false };
      }));
  }

  getFindings(entityCode: string, page = 1, pageSize = IRREGULARITIES_PAGE_SIZE, periodKey = PERIOD_KEY): Observable<IrregularitiesPage> {
    const params = new HttpParams().set('period_key', periodKey).set('page', page).set('pageSize', pageSize);
    return this.http
      .get<ApiResponse<ApiIrregularitiesPage>>(`${this.financeBase}/affiliate-submission-review/${encodeURIComponent(entityCode)}/irregularities-review`, { params })
      .pipe(map((response) => ({ ...response.data, items: response.data.items.map(mapFinding) })));
  }

  getIrregularitiesSummary(entityCode: string, periodKey = PERIOD_KEY): Observable<IrregularitiesSummary> {
    const params = new HttpParams().set('period_key', periodKey);
    return this.http
      .get<ApiResponse<IrregularitiesSummary>>(`${this.financeBase}/affiliate-submission-review/${encodeURIComponent(entityCode)}/irregularities-review/summary`, { params })
      .pipe(map((response) => response.data));
  }

  getCoaSummary(affiliate: string): Observable<CoaSummary> {
    const params = new HttpParams().set('affiliate', affiliate);
    return this.http.get<ApiResponse<CoaSummary>>(`${this.coaBase}/summary`, { params }).pipe(map((response) => response.data));
  }

  getCoaSchema(): Observable<CoaSchema> {
    return this.http.get<ApiResponse<CoaSchema>>(`${this.coaBase}/mappings/schema`).pipe(map((response) => response.data));
  }

  getCoaRows(affiliate: string, page = 1, pageSize = COA_PAGE_SIZE): Observable<CoaPage> {
    const params = new HttpParams().set('affiliate', affiliate).set('page', page).set('pageSize', pageSize);
    return this.http
      .get<ApiResponse<ApiCoaPage>>(`${this.coaBase}/mappings`, { params })
      .pipe(map((response) => ({
        ...response.data,
        // Do not sort or reformat these values. The API deliberately returns
        // pre-formatted values and rows already ordered by QTD magnitude.
        items: response.data.items.map((row) => ({
          rowId: row.rowId,
          code: row.affiliateAccount,
          description: row.description,
          monthValue: row.monthValue,
          qtdValue: row.qtdValue,
          ytdValue: row.ytdValue,
          currentGroupNode: row.currentGroupNode,
          selectedMapping: row.currentGroupMapping,
          mappingConfidence: row.mappingConfidence,
          status: row.status,
          rationale: row.rationale,
          canConfirm: row.canConfirm,
          confirmed: row.status === 'Confirmed',
          pendingSelection: row.currentGroupNode,
        })),
      })));
  }

  confirmCoaMapping(affiliate: string, rowId: string, groupNode: string): Observable<ApiConfirmResponse> {
    return this.http
      .post<ApiResponse<ApiConfirmResponse>>(`${this.coaBase}/confirm-mapping`, {
        rowId,
        affiliate,
        groupNode 
      }).pipe(map((response) => response.data));
  }
}
