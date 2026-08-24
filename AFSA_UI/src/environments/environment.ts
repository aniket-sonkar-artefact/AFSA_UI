export const environment = {
  production: false,
  useMockData: true,
  apiUrl: 'http://127.0.0.1:8080/api/v1',

  // Compliance Monitoring & Benchmarking — real backend (Cloud Shell web preview tunnel).
  // NOTE: Cloud Shell tunnel URLs are session-bound and can expire/change — update this
  // when that happens. Everything else stays a one-line change since only this constant
  // needs to move.
  complianceApiUrl: 'http://127.0.0.1:8080/api/v1',
};
