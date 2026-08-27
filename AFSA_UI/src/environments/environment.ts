export const environment = {
  production: false,
  useMockData: false,

  // Shared local backend used by Compliance Monitoring and CoA Mapping Review.
  localCoaHostUrl: 'http://127.0.0.1:8080/coa/api/v1',
  localIFRSHostUrl: 'http://127.0.0.1:8080/ifrs/api/v1',
  localhostUrl: 'http://127.0.0.1:8080/api/v1',

  // Financial Statement Integrity Check (Cross-Reference + Footing/Subfooting).
  localIntegrityHostUrl: 'http://127.0.0.1:8080/integrity/api/v1',

  // Affiliate Submission Review — Completeness + Irregularities.
  affiliateSubmissionApiUrl: 'https://finance-api-backend-746397763597.me-central2.run.app/api/v1',

  // Management Reports & Variance Analysis — direct browser-to-API calls.
  financialInsightsApiUrl: 'https://consolidated-financial-insights-api-746397763597.me-central2.run.app/api/v1',

  // Standard DOCX Reports (generic report generation) — same backend as financialInsightsApiUrl.
  docxReportsApiUrl: 'https://consolidated-financial-insights-api-746397763597.me-central2.run.app/api/v1',
};
