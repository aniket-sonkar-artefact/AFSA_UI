export interface AffiliateOverviewMetric {
  percentage: number;
  numerator: number;
  denominator: number;
}

export interface AffiliateOverviewRowApi {
  entityCode: string;
  entityName: string;
  submissionCompleteness: AffiliateOverviewMetric;
  irregularities: AffiliateOverviewMetric;
  coaMapping: AffiliateOverviewMetric;
}

export interface AffiliateOverviewApiData {
  period: string;
  submissionCompleteness: AffiliateOverviewMetric;
  irregularities: AffiliateOverviewMetric;
  coaMapping: AffiliateOverviewMetric;
  affiliates: AffiliateOverviewRowApi[];
}

export interface AffiliateOverviewApiResponse {
  success: boolean;
  data: AffiliateOverviewApiData;
  message: string;
  errors: unknown[];
}