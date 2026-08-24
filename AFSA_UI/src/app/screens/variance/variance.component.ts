import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import { GENERATION_STEPS, READINESS_ITEMS, VarianceService } from '../../core/services/variance.service';
import {
  GenerationHistoryRow,
  ManagementReportState,
  VarianceRow,
  WorkspaceTab,
} from '../../core/models/variance.model';

function buildFileName(period: string): string {
  return `${period.replace(/\s+/g, '_')}_Management_Report.pptx`;
}

@Component({
  selector: 'app-variance',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './variance.component.html',
  styleUrl: './variance.component.scss',
})
export class VarianceComponent implements OnInit {
  readonly generationSteps = GENERATION_STEPS;
  readonly readinessItems = READINESS_ITEMS;

  readonly tab = signal<WorkspaceTab>('variance');
  readonly toast = signal<string | null>(null);

  readonly rows = signal<VarianceRow[]>([]);
  readonly history = signal<GenerationHistoryRow[]>([]);

  readonly period = signal('Q1 2026');
  readonly comparison = signal('Q1 2025');
  readonly currency = signal('SAR (000s)');

  readonly reportState = signal<ManagementReportState>('idle');
  readonly generationStep = signal(0);
  readonly generatedAt = signal<string | null>(null);
  readonly generatedPeriod = signal<string | null>(null);
  readonly reportBasis = signal<string | null>(null);

  readonly historyCollapsed = signal(false);

  /* ---------- KPI values (Variance Analysis tab) ---------- */

  readonly revenueRow = computed(() => this.rows().find((r) => r.item === 'Revenue'));
  readonly grossProfitRow = computed(() => this.rows().find((r) => r.item === 'Gross Profit'));
  readonly netProfitRow = computed(() => this.rows().find((r) => r.item === 'Net Profit'));

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
    this.varianceService.getVarianceRows().subscribe((rows) => this.rows.set(rows));
    this.varianceService.getGenerationHistory().subscribe((history) => this.history.set(history));
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

  generateVarianceReport(): void {
    this.showToast('Variance Analysis Report generated');
  }

  downloadManagementReport(): void {
    this.showToast('Management Report PPTX downloaded');
  }

  goToIntegrity(): void {
    this.router.navigate(['/integrity']);
  }

  /* ---------- Management report generation (mocked, swap-ready — see VarianceService.generateManagementReport) ---------- */

  generateManagementReport(): void {
    if (this.reportState() === 'generating') return;

    this.reportState.set('generating');
    this.generationStep.set(0);

    this.varianceService.generateManagementReport().subscribe((event) => {
      this.generationStep.set(event.stepIndex);

      if (event.done) {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.generatedAt.set(`Today ${time}`);
        this.generatedPeriod.set(this.period());
        this.reportBasis.set(this.currentBasis());
        this.reportState.set('ready');
      }
    });
  }

  toggleHistory(): void {
    this.historyCollapsed.update((prev) => !prev);
  }
}
