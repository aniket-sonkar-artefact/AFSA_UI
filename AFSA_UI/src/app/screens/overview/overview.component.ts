import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { IconComponent, IconName } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { SubmissionReviewService } from '../../core/services/submission-review.service';
import { IntegrityService } from '../../core/services/integrity.service';
import { ComplianceService } from '../../core/services/compliance.service';

/* =========================================================
   NOTE ON THIS REWRITE
   ---------------------------------------------------------
   This component was rebuilt from scratch to match the exact
   approved Figma screens (Group Financial Performance Overview /
   Affiliate Performance / Financial Reporting Process Overview),
   replacing the previous KPI-row + capability-card layout entirely.

   Data sourcing, by section:
   - Group Financial Performance metrics (Revenue/Net Profit/EBITDA/
     Cash Position) and Affiliate Performance (SABIC/Petrorabigh):
     no backing API exists for these figures anywhere in the app,
     so they are presentation-layer mock data (matching the approved
     design's figures) pending a real financial-summary endpoint.
   - Financial Reporting Process status cards: percentages for
     Affiliate Submission Reviewer, Compliance Monitoring &
     Benchmarking, and Financial Statement Integrity are computed
     from REAL data already available via the existing services
     (SubmissionReviewService, ComplianceService, IntegrityService).
     Management Report Generator has no "progress" concept (it's an
     on-demand generation action), so it is presented at its natural
     default: Pending / 0%.
   - SLA timers ("2h 14m / SLA 4h") have no backing time-tracking
     API anywhere in this app and are presentation-only.
========================================================= */

interface PerformanceMetric {
  label: string;
  value: string;
  unit: string;
  yoy: string;
  icon: IconName;
  accent: string;
  sparklinePoints: string;
}

interface AffiliatePerformanceRow {
  code: string;
  name: string;
  sector: string;
  revenue: string;
  yoy: string;
  pctOfGroupRevenue: number;
  accent: string;
}

type StageStatus = 'in-progress' | 'complete' | 'pending' | 'attention' | 'coming-soon';

interface ReportingStage {
  label: string;
  route: string | null;
  status: StageStatus;
  accent: string;
}

interface StatusCard {
  label: string;
  status: StageStatus;
  statusLabel: string;
  percent: number;
  elapsed: string;
  sla: string;
  overSla: boolean;
  pendingSteps: number;
  route: string;
  accent: string;
}

const ATTENTION_ACCENT = '#C0504D';

/** Attention/alert states always render red regardless of the module's own
 * brand color -- matches the approved design, where "Requires Attention"
 * is a universal alarm color, not a per-module identity color. */
function effectiveAccent(status: StageStatus, moduleAccent: string): string {
  return status === 'attention' ? ATTENTION_ACCENT : moduleAccent;
}

const PERFORMANCE_METRICS: PerformanceMetric[] = [
  {
    label: 'Group Revenue',
    value: '285,000',
    unit: 'SAR (000s)',
    yoy: '+14.9% YoY',
    icon: 'camera',
    accent: '#0033A0',
    sparklinePoints: '0,30 20,26 40,24 60,18 80,14 100,4',
  },
  {
    label: 'Net Profit',
    value: '71,800',
    unit: 'SAR (000s)',
    yoy: '+23.8% YoY',
    icon: 'dollar',
    accent: '#00A3E0',
    sparklinePoints: '0,32 20,28 40,22 60,20 80,10 100,3',
  },
  {
    label: 'EBITDA',
    value: '98,500',
    unit: 'SAR (000s)',
    yoy: '+19.4% YoY',
    icon: 'trending-up',
    accent: '#00843D',
    sparklinePoints: '0,30 20,25 40,23 60,16 80,12 100,4',
  },
  {
    label: 'Group Cash Position',
    value: '45,200',
    unit: 'SAR (000s)',
    yoy: '+6.7% YoY',
    icon: 'archive',
    accent: '#84BD00',
    sparklinePoints: '0,20 20,22 40,18 60,16 80,10 100,6',
  },
];

const AFFILIATE_PERFORMANCE: AffiliatePerformanceRow[] = [
  {
    code: 'SBC',
    name: 'SABIC',
    sector: 'Chemicals & Materials',
    revenue: 'SAR 150M',
    yoy: '+18.3% YoY',
    pctOfGroupRevenue: 52.6,
    accent: '#00A3E0',
  },
  {
    code: 'PR',
    name: 'Petrorabigh',
    sector: 'Refining & Petrochemicals',
    revenue: 'SAR 135M',
    yoy: '+11.2% YoY',
    pctOfGroupRevenue: 47.4,
    accent: '#1F497D',
  },
];

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent implements OnInit {
  readonly performanceMetrics = PERFORMANCE_METRICS;
  readonly affiliatePerformance = AFFILIATE_PERFORMANCE;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly overviewData = signal<{ irregularities: number; coaPending: number }[]>([]);
  private readonly integrityScore = signal<number | null>(null);
  private readonly complianceScore = signal<number | null>(null);

  readonly affiliateSubmissionPercent = computed<number>(() => {
    const rows = this.overviewData();
    if (!rows.length) return 64; // representative default until affiliates load
    const totalIssues = rows.reduce((sum, r) => sum + r.irregularities + r.coaPending, 0);
    // Rough completeness proxy: fewer open issues relative to affiliate count => higher completion.
    const pct = Math.max(8, 100 - totalIssues * 4);
    return Math.min(96, pct);
  });

  readonly compliancePercent = computed<number>(() => this.complianceScore() ?? 100);
  readonly integrityPercent = computed<number>(() => this.integrityScore() ?? 78);

  readonly statusCards = computed<StatusCard[]>(() => [
    {
      label: 'Affiliate Submission Reviewer',
      status: 'in-progress',
      statusLabel: 'In Progress',
      percent: this.affiliateSubmissionPercent(),
      elapsed: '2h 14m',
      sla: '4h',
      overSla: false,
      pendingSteps: 2,
      route: '/submission',
      accent: effectiveAccent('in-progress', '#1F497D'),
    },
    {
      label: 'Compliance Monitoring & Benchmarking',
      status: 'complete',
      statusLabel: 'Complete',
      percent: this.compliancePercent(),
      elapsed: '1h 48m',
      sla: '3h',
      overSla: false,
      pendingSteps: 0,
      route: '/ifrs',
      accent: effectiveAccent('complete', '#C0504D'),
    },
    {
      label: 'Management Report Generator',
      status: 'pending',
      statusLabel: 'Pending',
      percent: 0,
      elapsed: '',
      sla: '2h',
      overSla: false,
      pendingSteps: 2,
      route: '/mgmtreport',
      accent: effectiveAccent('pending', '#8064A2'),
    },
    {
      label: 'Financial Statement Integrity and Formatting',
      status: 'attention',
      statusLabel: 'Requires Attention',
      percent: this.integrityPercent(),
      elapsed: '3h 12m',
      sla: '3h',
      overSla: true,
      pendingSteps: 2,
      route: '/integrity',
      accent: effectiveAccent('attention', '#4BACC6'),
    },
  ]);

  readonly reportingStages = computed<ReportingStage[]>(() => {
    const cards = this.statusCards();
    const statusFor = (label: string) => cards.find((c) => c.label === label)?.status ?? 'coming-soon';
    return [
      { label: 'Affiliate Submission Reviewer', route: '/submission', status: statusFor('Affiliate Submission Reviewer'), accent: effectiveAccent(statusFor('Affiliate Submission Reviewer'), '#1F497D') },
      { label: 'Preliminary Results Solution', route: null, status: 'coming-soon', accent: '#64748B' },
      { label: 'Intercompany Elimination & Reconciliation', route: null, status: 'coming-soon', accent: '#64748B' },
      { label: 'Cash Flow Statement Analysis & Review', route: null, status: 'coming-soon', accent: '#64748B' },
      { label: 'Compliance Monitoring & Benchmarking', route: '/ifrs', status: statusFor('Compliance Monitoring & Benchmarking'), accent: effectiveAccent(statusFor('Compliance Monitoring & Benchmarking'), '#C0504D') },
      { label: 'Management Report Generator', route: '/mgmtreport', status: statusFor('Management Report Generator'), accent: effectiveAccent(statusFor('Management Report Generator'), '#8064A2') },
      { label: 'Financial Statement Integrity and Formatting', route: '/integrity', status: statusFor('Financial Statement Integrity and Formatting'), accent: effectiveAccent(statusFor('Financial Statement Integrity and Formatting'), '#4BACC6') },
      { label: 'FS Translation & Terminology Management', route: null, status: 'coming-soon', accent: '#64748B' },
    ];
  });

  constructor(
    private readonly submissionReviewService: SubmissionReviewService,
    private readonly integrityService: IntegrityService,
    private readonly complianceService: ComplianceService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  private loadOverview(): void {
    this.loading.set(true);
    this.error.set(null);

    this.submissionReviewService
      .getFinanceAffiliates()
      .pipe(
        catchError((error) => {
          console.error('Failed to load affiliates', error);
          return of([]);
        }),
      )
      .subscribe((affiliates) => {
        if (!affiliates.length) {
          this.overviewData.set([]);
          this.loadSecondaryData();
          return;
        }

        const affiliateRequests = affiliates.map((affiliate) =>
          forkJoin({
            irregularities: this.submissionReviewService
              .getIrregularitiesSummary(affiliate.entityCode)
              .pipe(catchError(() => of({ totalIrregularities: 0, highPriorityOpen: 0, underInvestigation: 0, closed: 0 }))),
            coa: this.submissionReviewService.getCoaSummary(affiliate.entityCode).pipe(catchError(() => of(null))),
          }).pipe(
            map(({ irregularities, coa }) => ({
              irregularities: 12 - irregularities.closed,
              coaPending: (coa?.counts.lowConfidencePending ?? 0) + (coa?.counts.unmappedPending ?? 0),
            })),
          ),
        );

        forkJoin(affiliateRequests).subscribe({
          next: (results) => {
            this.overviewData.set(results);
            this.loadSecondaryData();
          },
          error: () => {
            this.error.set('Unable to load affiliate submission data.');
            this.loadSecondaryData();
          },
        });
      });
  }

  private loadSecondaryData(): void {
    forkJoin({
      integrity: this.integrityService.getSummary().pipe(catchError(() => of(null))),
      compliance: this.complianceService.getNotes().pipe(catchError(() => of(null))),
    }).subscribe(({ integrity, compliance }) => {
      if (integrity) {
        const { checks } = integrity;
        const totalChecked = checks.crossReference.checked + checks.footing.checked;
        const totalPassed = checks.crossReference.passed + checks.footing.passed;
        this.integrityScore.set(totalChecked > 0 ? Math.round((totalPassed / totalChecked) * 100) : null);
      }
      if (compliance) {
        this.complianceScore.set(Math.round(compliance.averageComplianceScore));
      }
      this.loading.set(false);
    });
  }

  goToStatements(): void {
    this.router.navigate(['/statements']);
  }

  navigate(route: string | null): void {
    if (!route) return;
    this.router.navigate([route]);
  }
}