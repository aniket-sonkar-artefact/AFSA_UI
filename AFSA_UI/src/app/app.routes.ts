import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./screens/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () => import('./screens/overview/overview.component').then((m) => m.OverviewComponent),
      },
      {
        // Reached only via the "View Group Financial Statements" CTA on
        // Overview -- intentionally not a sidebar nav item.
        path: 'statements',
        loadComponent: () =>
          import('./screens/statements/statements.component').then((m) => m.StatementsComponent),
      },
      {
        // Step 1 of the new Affiliate Submission flow: landing page with the
        // full affiliate list (new in the Figma redesign).
        path: 'submission',
        loadComponent: () =>
          import('./screens/affiliate-landing/affiliate-landing.component').then((m) => m.AffiliateLandingComponent),
      },
      {
        // Step 2: the existing Affiliate Submission Review page, now reached
        // after an affiliate has been selected on the landing page above.
        // ':entityCode' is optional in practice -- the component still works
        // if visited directly, falling back to its original "first affiliate"
        // default.
        path: 'submission/review/:entityCode',
        loadComponent: () =>
          import('./screens/submission-review/submission-review.component').then((m) => m.SubmissionReviewComponent),
      },
      {
        path: 'submission/review',
        loadComponent: () =>
          import('./screens/submission-review/submission-review.component').then((m) => m.SubmissionReviewComponent),
      },
      {
        path: 'ifrs',
        loadComponent: () => import('./screens/compliance/compliance.component').then((m) => m.ComplianceComponent),
      },
      {
        // "Management Reports & Variance Analysis" is now split in two:
        // Management Report Generator here, and Variance Analysis moved to
        // the Home/Overview screen as a sub-component (see overview/variance-insight).
        path: 'mgmtreport',
        loadComponent: () =>
          import('./screens/management-report/management-report.component').then((m) => m.ManagementReportComponent),
      },
      // Legacy deep link support: anything that used to point at /variance
      // now lands on the new Management Report Generator page.
      { path: 'variance', redirectTo: 'mgmtreport' },
      {
        path: 'integrity',
        loadComponent: () => import('./screens/integrity/integrity.component').then((m) => m.IntegrityComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./screens/reports/reports.component').then((m) => m.ReportsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'overview' },
];
