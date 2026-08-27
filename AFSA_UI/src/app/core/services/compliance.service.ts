import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  ComplianceCheckResult,
  ComplianceNotesResponse,
  NoteNarrative,
  NoteSchema,
  NoteTableData,
} from '../models/compliance.model';

@Injectable({ providedIn: 'root' })
export class ComplianceService {
  private readonly base = `${environment.localIFRSHostUrl}/compliance-monitoring`;

  constructor(private readonly http: HttpClient) {}

  /** GET /compliance-monitoring/notes — header info + IFRS notes sidebar list */
  getNotes(): Observable<ComplianceNotesResponse> {
    return this.http
      .get<ApiResponse<ComplianceNotesResponse>>(`${this.base}/notes`)
      .pipe(map((res) => res.data));
  }

  /** GET /compliance-monitoring/notes/{noteId}/schema — table count + column structure */
  getSchema(noteId: string): Observable<NoteSchema> {
    return this.http
      .get<ApiResponse<NoteSchema>>(`${this.base}/notes/${noteId}/schema`)
      .pipe(map((res) => res.data));
  }

  /**
   * GET /compliance-monitoring/notes/{noteId}/data — rows for one table.
   * `tableId` is omitted from the request entirely when the note has only
   * one table (per the API contract), rather than sent as null/empty.
   */
  getTableData(
    noteId: string,
    tableId: string | null,
    page = 1,
    pageSize = 50,
  ): Observable<NoteTableData> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (tableId) {
      params = params.set('table', tableId);
    }

    return this.http
      .get<ApiResponse<NoteTableData>>(`${this.base}/notes/${noteId}/data`, { params })
      .pipe(map((res) => res.data));
  }

  /** GET /compliance-monitoring/notes/{noteId}/narrative — editable disclosure text */
  getNarrative(noteId: string): Observable<NoteNarrative> {
    return this.http
      .get<ApiResponse<NoteNarrative>>(`${this.base}/notes/${noteId}/narrative`)
      .pipe(map((res) => res.data));
  }

  /** POST /compliance-monitoring/notes/{noteId}/compliance-check — run the check on the given narrative */
  runComplianceCheck(noteId: string, narrative: string): Observable<ComplianceCheckResult> {
    return this.http
      .post<ApiResponse<ComplianceCheckResult>>(`${this.base}/notes/${noteId}/compliance-check`, {
        narrative,
      })
      .pipe(map((res) => res.data));
  }
}
