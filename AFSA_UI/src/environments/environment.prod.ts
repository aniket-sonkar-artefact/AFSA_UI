export const environment = {
  production: true,
  useMockData: false,

  // Shared local backend used by Compliance Monitoring and CoA Mapping Review.
  localhostUrl: 'http://127.0.0.1:8080/api/v1',

  // Financial Statement Integrity Check (Cross-Reference + Footing/Subfooting).
  localIntegrityHostUrl: 'http://127.0.0.1:8080/api/v1',

  // Affiliate Submission Review — Completeness + Irregularities.
  affiliateSubmissionApiUrl: 'https://finance-api-backend-746397763597.me-central2.run.app/api/v1',

  // Management Reports & Variance Analysis — direct browser-to-API calls.
  financialInsightsApiUrl: 'https://consolidated-financial-insights-api-746397763597.me-central2.run.app/api/v1',

  // Standard DOCX Reports (generic report generation) — same backend as financialInsightsApiUrl.
  docxReportsApiUrl: 'https://consolidated-financial-insights-api-746397763597.me-central2.run.app/api/v1',
};
