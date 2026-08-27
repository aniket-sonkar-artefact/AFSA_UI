import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  CheckId,
  FootingTablePage,
  IntegritySummary,
  IntegrityTableSchema,
  IntegrityTablePage,
  MarkCompleteRequest,
  MarkCompleteResponse,
  XRefRow,
  FootingRow,
} from '../models/integrity.model';

@Injectable({ providedIn: 'root' })
export class IntegrityService {
  private readonly base = `${environment.localIntegrityHostUrl}/statement-validation/integrity-check`;

  constructor(private readonly http: HttpClient) {}

  /** GET /summary — header strip: entity, period, review status, per-check counts. */
  getSummary(refresh = false): Observable<IntegritySummary> {
    let params = new HttpParams();
    if (refresh) params = params.set('refresh', 'true');
    return this.http
      .get<ApiResponse<IntegritySummary>>(`${this.base}/summary`, { params })
      .pipe(map((res) => res.data));
  }

  /** GET /cross-reference/schema — columns, badge vocab, count-card labels. Fetch once. */
  getCrossReferenceSchema(): Observable<IntegrityTableSchema> {
    return this.http
      .get<ApiResponse<IntegrityTableSchema>>(`${this.base}/cross-reference/schema`)
      .pipe(map((res) => res.data));
  }

  /** GET /footing/schema — columns, badge vocab, count-card labels. Fetch once. */
  getFootingSchema(): Observable<IntegrityTableSchema> {
    return this.http
      .get<ApiResponse<IntegrityTableSchema>>(`${this.base}/footing/schema`)
      .pipe(map((res) => res.data));
  }

  /** GET /cross-reference — Tab 1 count cards + paginated rows. */
  getCrossReferenceRows(
    page = 1,
    pageSize = 10,
    opts: { flaggedOnly?: boolean; refresh?: boolean } = {},
  ): Observable<IntegrityTablePage<XRefRow>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (opts.flaggedOnly) params = params.set('flaggedOnly', 'true');
    if (opts.refresh) params = params.set('refresh', 'true');

    return this.http
      .get<ApiResponse<IntegrityTablePage<XRefRow>>>(`${this.base}/cross-reference`, { params })
      .pipe(map((res) => res.data));
  }

  /** GET /footing — Tab 2 count cards + paginated rows. */
  getFootingRows(
    page = 1,
    pageSize = 10,
    opts: { flaggedOnly?: boolean; refresh?: boolean } = {},
  ): Observable<FootingTablePage> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (opts.flaggedOnly) params = params.set('flaggedOnly', 'true');
    if (opts.refresh) params = params.set('refresh', 'true');

    return this.http
      .get<ApiResponse<FootingTablePage>>(`${this.base}/footing`, { params })
      .pipe(map((res) => res.data));
  }

  /** POST /mark-complete — sign off (or undo sign-off) one flagged row. */
  markComplete<T extends XRefRow | FootingRow>(
    checkId: CheckId,
    lineId: string,
    complete = true,
  ): Observable<MarkCompleteResponse<T>> {
    const body: MarkCompleteRequest = { checkId, lineId, complete };
    return this.http
      .post<ApiResponse<MarkCompleteResponse<T>>>(`${this.base}/mark-complete`, body)
      .pipe(map((res) => res.data));
  }
}
