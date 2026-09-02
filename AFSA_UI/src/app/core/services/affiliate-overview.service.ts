import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AffiliateOverviewApiData, AffiliateOverviewApiResponse } from '../models/affiliate-overview.model';

@Injectable({ providedIn: 'root' })
export class AffiliateOverviewService {
  constructor(private readonly http: HttpClient) {}

  getOverview(periodKey: string): Observable<AffiliateOverviewApiData> {
    return this.http
      .get<AffiliateOverviewApiResponse>(
        `${environment.affiliateSubmissionApiUrl}/affiliate-submission-review/overview`,
        { params: { period_key: periodKey } },
      )
      .pipe(map((res) => res.data));
  }
}