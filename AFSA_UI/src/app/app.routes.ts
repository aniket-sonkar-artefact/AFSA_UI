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
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () => import('./screens/overview/overview.component').then((m) => m.OverviewComponent),
      },
      {
        path: 'submission',
        loadComponent: () =>
          import('./screens/submission-review/submission-review.component').then((m) => m.SubmissionReviewComponent),
      },
      {
        path: 'ifrs',
        loadComponent: () => import('./screens/compliance/compliance.component').then((m) => m.ComplianceComponent),
      },
      {
        path: 'variance',
        loadComponent: () => import('./screens/variance/variance.component').then((m) => m.VarianceComponent),
      },
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
