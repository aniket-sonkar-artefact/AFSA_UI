import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import {
  GENERATION_STEPS,
  READINESS_ITEMS,
  VarianceService,
  toApiPeriod,
  fromApiPeriod,
} from '../../core/services/variance.service';
import { FinancialInsightsApiResponse, ManagementReportState } from '../../core/models/variance.model';

/** NOTE ON THIS COMPONENT'S ORIGIN
 *  ---------------------------------------------------------------
 *  This screen used to be the "Management" tab inside the combined
 *  "Management Reports & Variance Analysis" page (screens/variance).
 *  Per the new Figma UI, that combined page is split in two:
 *    1. Management Report Generator  → this page, now standalone at /mgmtreport
 *    2. Variance Analysis            → moved to the Home/Overview screen
 *       as a sub-component (see screens/overview/variance-insight)
 *  The report-generation logic and VarianceService API calls are
 *  unchanged from the original implementation — only the page shell,
 *  routing and (now removed) tab switcher have changed.
 */

function buildFileName(period: string): string {
  return `${period.replace(/\s+/g, '_')}_Management_Report.pptx`;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as FinancialInsightsApiResponse<unknown> | undefined;
    const first = body?.errors?.[0];
    if (first?.message) return first.message;
  }
  return fallback;
}

@Component({
  selector: 'app-management-report',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './management-report.component.html',
  styleUrl: './management-report.component.scss',
})
export class ManagementReportComponent implements OnInit, OnDestroy {
  readonly generationSteps = GENERATION_STEPS;
  readonly readinessItems = READINESS_ITEMS;

  readonly toast = signal<string | null>(null);

  readonly period = signal('Q1 2026');
  readonly currency = signal('SAR (000s)');

  readonly reportState = signal<ManagementReportState>('idle');
  readonly generationStep = signal(0);
  readonly generatedAt = signal<string | null>(null);
  readonly generatedPeriod = signal<string | null>(null);
  readonly reportBasis = signal<string | null>(null);

  readonly historyCollapsed = signal(false);

  private reportId: string | null = null;
  private downloadUrl: string | null = null;
  private downloadExpiresAt: string | null = null;
  private generationTicker: ReturnType<typeof setInterval> | null = null;

  private readonly currentBasis = computed(() => JSON.stringify({ period: this.period(), currency: this.currency() }));

  readonly reportNeedsRefresh = computed(
    () => this.reportState() === 'ready' && this.reportBasis() !== null && this.reportBasis() !== this.currentBasis(),
  );

  readonly reportFileName = computed(() => buildFileName(this.generatedPeriod() ?? this.period()));

  constructor(private readonly varianceService: VarianceService, private readonly router: Router) {}

  ngOnInit(): void {
    /* No initial data fetch is required — generation readiness is derived
     * from static template metadata (READINESS_ITEMS), matching the
     * original combined page's behaviour. */
  }

  ngOnDestroy(): void {
    this.stopGenerationTicker();
  }

  private showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(null), 3000);
  }

  goToIntegrity(): void {
    this.router.navigate(['/integrity']);
  }

  private stopGenerationTicker(): void {
    if (this.generationTicker !== null) {
      clearInterval(this.generationTicker);
      this.generationTicker = null;
    }
  }

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
