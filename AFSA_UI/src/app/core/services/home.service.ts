import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HomeApiData } from '../models/home.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: { code: string; message: string }[];
}

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly base = environment.financialInsightsApiUrl;

  constructor(private readonly http: HttpClient) {}

  getHome(period: string): Observable<HomeApiData> {
    return this.http.post<ApiResponse<HomeApiData>>(`${this.base}/home`, { period }).pipe(map((res) => res.data));
  }
}