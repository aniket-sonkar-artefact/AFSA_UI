import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChecklistGroup,
  ChecklistStatus,
  CoaPage,
  CoaSchema,
  CoaSummary,
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
  accountType: string;
  mtd: number | null;
  mtdPrior: number | null;
  mtdDelta: string | null;
  mtdDeltaObservation: string | null;
  qtd: number | null;
  qtdPrior: number | null;
  qtdDelta: string | null;
  qtdDeltaObservation: string | null;
  ytd: number | null;
  ytdPrior: number | null;
  ytdDelta: string | null;
  ytdDeltaObservation: string | null;
  priority: 'High' | 'Medium' | 'Low';
  flag: string;
  status: string;
}

interface ApiIrregularitiesPage {
  items: ApiFinding[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  resultCount: number;
  totalPages: number;
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

function mapFinding(row: ApiFinding): Finding {
  return {
    accountCode: row.accountCode,
    account: row.account,
    accountType: row.accountType,
    mtd: row.mtd,
    mtdPrior: row.mtdPrior,
    mtdDelta: row.mtdDelta,
    mtdDeltaObservation: row.mtdDeltaObservation,
    qtd: row.qtd,
    qtdPrior: row.qtdPrior,
    qtdDelta: row.qtdDelta,
    qtdDeltaObservation: row.qtdDeltaObservation,
    ytd: row.ytd,
    ytdPrior: row.ytdPrior,
    ytdDelta: row.ytdDelta,
    ytdDeltaObservation: row.ytdDeltaObservation,
    priority: row.priority,
    flag: row.flag,
    status: toFindingStatus(row.status),
  };
}

@Injectable({ providedIn: 'root' })
export class SubmissionReviewService {
  private readonly financeBase = environment.affiliateSubmissionApiUrl;
  /* CoA mapping endpoints now scope the affiliate code into the URL path
   * itself: /api/v1/affiliate-review/{affiliateCode}/coa-mapping/...
   * -- rather than a fixed "sabic" query param, each method below
   * interpolates the affiliate code it's called with. */
  private readonly coaBase = `${environment.coaMappingApiUrl}/affiliate-review`;

  constructor(private readonly http: HttpClient) {}

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

  /** GET /api/v1/affiliate-review/{affiliateCode}/coa-mapping/summary */
  getCoaSummary(affiliate: string): Observable<CoaSummary> {
    return this.http
      .get<ApiResponse<CoaSummary>>(`${this.coaBase}/${encodeURIComponent(affiliate)}/coa-mapping/summary`)
      .pipe(map((response) => response.data));
  }

  getCoaSchema(): Observable<CoaSchema> {
    return this.http.get<ApiResponse<CoaSchema>>(`${this.coaBase}/coa-mapping/mappings/schema`).pipe(map((response) => response.data));
  }

  /** GET /api/v1/affiliate-review/{affiliateCode}/coa-mapping/mappings?page=&pageSize= */
  getCoaRows(affiliate: string, page = 1, pageSize = COA_PAGE_SIZE): Observable<CoaPage> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http
      .get<ApiResponse<ApiCoaPage>>(`${this.coaBase}/${encodeURIComponent(affiliate)}/coa-mapping/mappings`, { params })
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
      .post<ApiResponse<ApiConfirmResponse>>(`${this.coaBase}/${encodeURIComponent(affiliate)}/coa-mapping/confirm-mapping`, {
        rowId,
        groupNode,
      }).pipe(map((response) => response.data));
  }

  updateFindingStatus(
    entityCode: string,
    accountCode: string,
    status: FindingStatus,
    periodKey = PERIOD_KEY,
  ): Observable<{ accountCode: string; status: FindingStatus }> {
    const params = new HttpParams().set('period_key', periodKey);
    return this.http
      .post<ApiResponse<{ accountCode: string; status: string }>>(
        `${this.financeBase}/affiliate-submission-review/${encodeURIComponent(entityCode)}/irregularities-review/${encodeURIComponent(accountCode)}/status`,
        { status },
        { params },
      )
      .pipe(map((response) => ({ accountCode: response.data.accountCode, status: toFindingStatus(response.data.status) })));
  }
}