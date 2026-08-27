import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import { Subscription } from 'rxjs';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import {
  GENERATION_STEPS,
  READINESS_ITEMS,
  VarianceService,
  fromApiPeriod,
  mapApiRowToVarianceRow,
  toApiPeriod,
} from '../../core/services/variance.service';
import {
  FinancialInsightsApiResponse,
  ManagementReportState,
  VarianceRow,
  WorkspaceTab,
} from '../../core/models/variance.model';

function buildFileName(period: string): string {
  return `${period.replace(/\s+/g, '_')}_Management_Report.pptx`;
}

/** Best-effort extraction of a human-readable message from a failed HttpClient call
 *  against the Financial Insights API envelope ({success:false, errors:[{code,message}]}). */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as FinancialInsightsApiResponse<unknown> | undefined;
    const first = body?.errors?.[0];
    if (first?.message) return first.message;
  }
  return fallback;
}

@Component({
  selector: 'app-variance',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, SkeletonComponent],
  templateUrl: './variance.component.html',
  styleUrl: './variance.component.scss',
})
export class VarianceComponent implements OnInit, OnDestroy {
  readonly generationSteps = GENERATION_STEPS;
  readonly readinessItems = READINESS_ITEMS;
  private varianceSub: Subscription | null = null;

  readonly tab = signal<WorkspaceTab>('variance');
  readonly toast = signal<string | null>(null);

  readonly rows = signal<VarianceRow[]>([]);
  readonly varianceLoading = signal(false);

  readonly period = signal('Q1 2026');
  readonly comparison = signal('Q1 2025');
  readonly currency = signal('SAR (000s)');

  readonly reportState = signal<ManagementReportState>('idle');
  readonly generationStep = signal(0);
  readonly generatedAt = signal<string | null>(null);
  readonly generatedPeriod = signal<string | null>(null);
  readonly reportBasis = signal<string | null>(null);

  readonly historyCollapsed = signal(false);

  /* ---------- Real-API state (Consolidated Financial Insights API) ---------- */

  private analysisId: string | null = null;
  private reportId: string | null = null;
  private downloadUrl: string | null = null;
  private downloadExpiresAt: string | null = null;
  private generationTicker: ReturnType<typeof setInterval> | null = null;

  /* ---------- KPI values (Variance Analysis tab) ---------- */

  readonly revenueRow = computed(() => this.rows().find((r) => r.item === 'Revenue'));
  readonly OperatingCostRow = computed(() => this.rows().find((r) => r.item === 'Operating costs'));
  readonly CurrentAssetsRow = computed(() => this.rows().find((r) => r.item === 'Current assets'));

  /* ---------- Report status ---------- */

  private readonly currentBasis = computed(() =>
    JSON.stringify({ period: this.period(), comparison: this.comparison(), currency: this.currency() }),
  );

  readonly reportNeedsRefresh = computed(
    () => this.reportState() === 'ready' && this.reportBasis() !== null && this.reportBasis() !== this.currentBasis(),
  );

  readonly reportFileName = computed(() => buildFileName(this.generatedPeriod() ?? this.period()));

  constructor(
    private readonly varianceService: VarianceService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.refreshVariance();
  }

  ngOnDestroy(): void {
    this.stopGenerationTicker();
    this.varianceSub?.unsubscribe();
  }

  /* ---------- Formatting ---------- */

  formatNumber(value: number): string {
    if (value === 0) return '—';
    const abs = Math.abs(value).toLocaleString('en-US');
    return value < 0 ? `(${abs})` : abs;
  }

  movementColor(value: number): string {
    return value >= 0 ? 'var(--variance-success)' : 'var(--variance-danger)';
  }

  pctPillClass(row: VarianceRow): string {
    if (row.comparison === 0) return 'variance-pct-na';
    return row.variance >= 0 ? 'variance-pct-positive' : 'variance-pct-negative';
  }

  /* ---------- Tabs / toast ---------- */

  setTab(tab: WorkspaceTab): void {
    this.tab.set(tab);
  }

  private showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(null), 3000);
  }

  /* ---------- Group Variance Analysis (POST + poll GET, per API guide §1) ---------- */

  /** Re-run whenever period/comparison change, and once on load. */
  onFiltersChanged(): void {
    this.refreshVariance();
  }

  varianceColorClass(color: string | null | undefined): string {
    switch (color?.toLowerCase()) {
      case 'green':
        return 'variance-color-green';

      case 'red':
        return 'variance-color-red';

      default:
        return 'variance-color-neutral';
    }
  }

  refreshVariance(): void {
    // Cancel any in-flight variance analysis (POST or poll) before starting a new one.
    this.varianceSub?.unsubscribe();
    this.varianceSub = null;

    const targetPeriod = toApiPeriod(this.period());
    const comparisonPeriod = toApiPeriod(this.comparison());

    if (!targetPeriod || !comparisonPeriod) {
      this.showToast('Select a valid actual period and comparison period (e.g. Q1 2026).');
      return;
    }
    if (targetPeriod === comparisonPeriod) {
      this.showToast('Actual period and comparison period must be different.');
      return;
    }

    this.varianceLoading.set(true);
    this.rows.set([]);
    this.analysisId = null;

    this.varianceSub = this.varianceService.startVarianceAnalysis(targetPeriod, comparisonPeriod).subscribe({
      next: (data) => {
        this.analysisId = data.analysis_id;
        this.rows.set(data.rows.map(mapApiRowToVarianceRow));
        this.varianceSub = this.varianceService.pollVarianceAnalysis(data.analysis_id).subscribe({
          next: (poll) => {
            if (poll.status === 'ready' || poll.status === 'failed') {
              this.rows.set(poll.rows.map(mapApiRowToVarianceRow));
              this.varianceLoading.set(false);
            }
            if (poll.status === 'failed') {
              this.showToast(poll.error ?? 'Variance analysis failed. Please try again.');
            }
          },
          error: (err) => {
            this.varianceLoading.set(false);
            this.showToast(extractErrorMessage(err, 'Could not check variance analysis status.'));
          },
        });
      },
      error: (err) => {
        this.varianceLoading.set(false);
        this.showToast(extractErrorMessage(err, 'Could not start variance analysis.'));
      },
    });
  }

  goToIntegrity(): void {
    this.router.navigate(['/integrity']);
  }

  /* ---------- Management report generation (POST + poll GET, per API guide §2) ---------- */

  private stopGenerationTicker(): void {
    if (this.generationTicker !== null) {
      clearInterval(this.generationTicker);
      this.generationTicker = null;
    }
  }

  /** Cosmetic step cycling while we wait on "queued"/"running" — the real API only
   *  reports coarse status, so this keeps the existing step list feeling alive
   *  without claiming knowledge the backend doesn't give us. Caps one step before
   *  the end until the API actually reports "ready". */
  private startGenerationTicker(): void {
    this.stopGenerationTicker();
    const lastIndex = GENERATION_STEPS.length - 1;
    this.generationStep.set(0);
    this.generationTicker = setInterval(() => {
      this.generationStep.update((step) => (step < lastIndex - 1 ? step + 1 : step));
    }, 1600);
  }

  generateManagementReport(): void {
    if (this.reportState() === 'generating') return;

    this.reportState.set('generating');

    const targetPeriod = toApiPeriod(this.period());
    if (!targetPeriod) {
      this.reportState.set('idle');
      this.showToast('Select a valid actual period (e.g. Q1 2026) before generating.');
      return;
    }

    this.startGenerationTicker();

    this.varianceService.startManagementReport(targetPeriod).subscribe({
      next: (data) => {
        this.reportId = data.report_id;

        this.varianceService.pollManagementReport(data.report_id).subscribe({
          next: (poll) => {
            if (poll.status === 'ready') {
              this.stopGenerationTicker();
              this.downloadUrl = poll.download_url ?? null;
              this.downloadExpiresAt = poll.expires_at ?? null;
              this.finishReport(fromApiPeriod(targetPeriod));
            } else if (poll.status === 'failed') {
              this.stopGenerationTicker();
              this.reportState.set('idle');
              this.showToast(poll.error ?? 'Management Report generation failed. Please try again.');
            }
          },
          error: (err) => {
            this.stopGenerationTicker();
            this.reportState.set('idle');
            this.showToast(extractErrorMessage(err, 'Could not check report generation status.'));
          },
        });
      },
      error: (err) => {
        this.stopGenerationTicker();
        this.reportState.set('idle');
        this.showToast(extractErrorMessage(err, 'Could not start report generation.'));
      },
    });
  }

  private finishReport(period: string): void {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.generationStep.set(GENERATION_STEPS.length - 1);
    this.generatedAt.set(`Today ${time}`);
    this.generatedPeriod.set(period);
    this.reportBasis.set(this.currentBasis());
    this.reportState.set('ready');
  }

  downloadManagementReport(): void {
    if (this.downloadUrl && !this.isDownloadUrlExpired()) {
      window.location.href = this.downloadUrl;
      return;
    }

    if (!this.reportId) {
      this.showToast('No report available to download yet.');
      return;
    }

    // Signed URL expired (15 min TTL) — re-fetch status to get a fresh one.
    this.varianceService.getManagementReportStatus(this.reportId).subscribe({
      next: (data) => {
        if (data.status === 'ready' && data.download_url) {
          this.downloadUrl = data.download_url;
          this.downloadExpiresAt = data.expires_at ?? null;
          window.location.href = data.download_url;
        } else {
          this.showToast('Report is no longer ready. Please regenerate.');
        }
      },
      error: (err) => this.showToast(extractErrorMessage(err, 'Could not refresh the download link.')),
    });
  }

  private isDownloadUrlExpired(): boolean {
    if (!this.downloadExpiresAt) return false;
    return Date.now() >= new Date(this.downloadExpiresAt).getTime();
  }

  toggleHistory(): void {
    this.historyCollapsed.update((prev) => !prev);
  }
}
