import { Component, OnDestroy, OnInit, AfterViewInit, ElementRef, QueryList, ViewChildren, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { IconComponent } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import {
  VarianceService,
  mapApiRowToVarianceRow,
  toApiPeriod,
} from '../../core/services/variance.service';
import { FinancialInsightsApiResponse, VarianceRow } from '../../core/models/variance.model';

/* =========================================================
   NOTE ON THIS COMPONENT
   ---------------------------------------------------------
   Reached only via the "View Group Financial Statements" CTA
   card on the Home/Overview screen (not a sidebar nav item —
   matches the approved design, where this lives one level
   below Home rather than in the main navigation).

   Data sourcing:
   - Income Statement tab: real VarianceService data (same
     group-variance-analysis endpoint used elsewhere in the
     app), with a mock fallback matching the approved design's
     exact figures if the API call fails.
   - "vs. Budget" figures on the 3 summary cards: no budget-
     comparison endpoint exists anywhere in this app yet, so
     these are presentation-only mock values pending a real
     budget/actuals integration.
   - "vs. Prior Period" figures on the 3 summary cards: real,
     derived directly from the same variance rows as the table.
   - Balance Sheet tab: no backing API exists; presentation-only
     mock rows in the same shape as the Income Statement table.
   - Cash Flow Statement tab: intentionally locked/disabled,
     matching the approved design (no data source planned yet).
   - Monthly / Yearly period granularity: the underlying API only
     supports quarter-labelled periods (e.g. "Q1 2026"), so those
     two options show a "coming soon" toast rather than silently
     returning wrong data.
========================================================= */

type StatementTab = 'income' | 'balance' | 'cashflow';
type Granularity = 'Monthly' | 'Quarterly' | 'Yearly';

interface SummaryMetric {
  label: string;
  value: string;
  icon: 'image' | 'camera' | 'trending-up' | 'dollar' | 'layers' | 'scale' | 'clock';
  accent: string;
  vsBudget: string;
  vsBudgetPositive: boolean;
  vsPrior: string;
  vsPriorPositive: boolean;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as FinancialInsightsApiResponse<unknown> | undefined;
    const first = body?.errors?.[0];
    if (first?.message) return first.message;
  }
  return fallback;
}

const BALANCE_SHEET_MOCK: VarianceRow[] = [
  { item: 'Cash and cash equivalents', current: 45200, comparison: 42350, variance: 2850, varPct: '+6.7%', color: 'green', analysis: 'Cash position improved on stronger operating collections.' },
  { item: 'Trade receivables', current: 96500, comparison: 88250, variance: 8250, varPct: '+9.3%', color: 'red', analysis: 'Higher receivables balance carried from Q4 close.' },
  { item: 'Total current assets', current: 187300, comparison: 172100, variance: 15200, varPct: '+8.8%', color: 'green', analysis: 'Growth driven by cash and receivables balances.', isSubtotal: true },
  { item: 'Property, plant and equipment', current: 412600, comparison: 405900, variance: 6700, varPct: '+1.7%', color: 'green', analysis: 'Modest capex additions during the period.' },
  { item: 'Total assets', current: 599900, comparison: 578000, variance: 21900, varPct: '+3.8%', color: 'green', analysis: 'Overall balance sheet growth in line with operations.', isSubtotal: true },
  { item: 'Trade payables', current: 74300, comparison: 71800, variance: 2500, varPct: '+3.5%', color: 'red', analysis: 'Payables grew broadly in line with purchasing volumes.' },
  { item: 'Total liabilities', current: 265400, comparison: 258100, variance: 7300, varPct: '+2.8%', color: 'red', analysis: 'Liability growth remains below asset growth.', isSubtotal: true },
  { item: "Total shareholders' equity", current: 334500, comparison: 319900, variance: 14600, varPct: '+4.6%', color: 'green', analysis: 'Equity growth driven by retained period earnings.', isSubtotal: true },
];

@Component({
  selector: 'app-statements',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, SkeletonComponent],
  templateUrl: './statements.component.html',
  styleUrl: './statements.component.scss',
})
export class StatementsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('tabBtn') private readonly tabBtnRefs!: QueryList<ElementRef<HTMLButtonElement>>;
  @ViewChildren('granBtn') private readonly granBtnRefs!: QueryList<ElementRef<HTMLButtonElement>>;

  private readonly tabRects = signal<{ left: number; width: number }[]>([]);
  private readonly granRects = signal<{ left: number; width: number }[]>([]);

  /** Sliding-pill indicator positions -- measured once from the real
   * rendered button geometry so the highlight can smoothly translate/resize
   * between tabs of different widths instead of an instant colour swap. */
  readonly tabIndicatorStyle = computed(() => {
    const idx = ['income', 'balance', 'cashflow'].indexOf(this.activeTab());
    const rect = this.tabRects()[idx];
    return rect ? { left: `${rect.left}px`, width: `${rect.width}px`, opacity: 1 } : { left: '0px', width: '0px', opacity: 0 };
  });

  readonly granIndicatorStyle = computed(() => {
    const idx = this.granularityOptions.indexOf(this.granularity());
    const rect = this.granRects()[idx];
    return rect ? { left: `${rect.left}px`, width: `${rect.width}px`, opacity: 1 } : { left: '0px', width: '0px', opacity: 0 };
  });

  private measureIndicators(): void {
    this.tabRects.set(
      this.tabBtnRefs.toArray().map((ref) => ({ left: ref.nativeElement.offsetLeft, width: ref.nativeElement.offsetWidth })),
    );
    this.granRects.set(
      this.granBtnRefs.toArray().map((ref) => ({ left: ref.nativeElement.offsetLeft, width: ref.nativeElement.offsetWidth })),
    );
  }

  ngAfterViewInit(): void {
    // Wait one frame so layout/fonts have settled before measuring.
    requestAnimationFrame(() => this.measureIndicators());
    this.tabBtnRefs.changes.subscribe(() => requestAnimationFrame(() => this.measureIndicators()));
    this.granBtnRefs.changes.subscribe(() => requestAnimationFrame(() => this.measureIndicators()));
    window.addEventListener('resize', this.onResize);
  }

  private readonly onResize = (): void => this.measureIndicators();

  private varianceSub: Subscription | null = null;

  readonly granularityOptions: Granularity[] = ['Monthly', 'Quarterly', 'Yearly'];

  readonly activeTab = signal<StatementTab>('income');
  readonly granularity = signal<Granularity>('Quarterly');
  readonly period = signal('Q1 2026');
  readonly comparison = signal('Q1 2025');
  readonly currency = signal('SAR (000s)');
  readonly toast = signal<string | null>(null);
  readonly expandAll = signal(false);
  readonly collapsedRows = signal<Set<string>>(new Set());

  readonly incomeRows = signal<VarianceRow[]>([]);
  readonly loading = signal(true);

  readonly balanceRows = signal<VarianceRow[]>(BALANCE_SHEET_MOCK);

  readonly activeRows = computed<VarianceRow[]>(() =>
    this.activeTab() === 'balance' ? this.balanceRows() : this.incomeRows(),
  );

  private readonly revenueRow = computed(() => this.incomeRows().find((r) => r.item.toLowerCase().startsWith('revenue')));
  private readonly operatingIncomeRow = computed(() => this.incomeRows().find((r) => r.item === 'Operating income'));
  private readonly netIncomeRow = computed(() => this.incomeRows().find((r) => r.item === 'Net income'));

  readonly incomeSummaryMetrics = computed<SummaryMetric[]>(() => [
    {
      label: 'Revenue',
      value: this.formatNumber(this.revenueRow()?.current ?? 0),
      icon: 'camera',
      accent: '#0033A0',
      vsBudget: '+4.8%',
      vsBudgetPositive: true,
      vsPrior: this.revenueRow()?.varPct ?? '—',
      vsPriorPositive: true,
    },
    {
      label: 'Operating Income',
      value: this.formatNumber(this.operatingIncomeRow()?.current ?? 0),
      icon: 'trending-up',
      accent: '#00A3E0',
      vsBudget: '+4.2%',
      vsBudgetPositive: true,
      vsPrior: this.operatingIncomeRow()?.varPct ?? '—',
      vsPriorPositive: true,
    },
    {
      label: 'Net Income',
      value: this.formatNumber(this.netIncomeRow()?.current ?? 0),
      icon: 'dollar',
      accent: '#00843D',
      vsBudget: '+4.5%',
      vsBudgetPositive: true,
      vsPrior: this.netIncomeRow()?.varPct ?? '—',
      vsPriorPositive: true,
    },
  ]);

  /* Balance Sheet has its own set of headline metrics (Total Assets / Total
   * Liabilities / Total Equity) rather than reusing the Income Statement's
   * Revenue / Operating Income / Net Income cards. Mock figures match the
   * approved design pending a real balance-sheet summary endpoint.
   *
   * Note the inverted "good direction" for Total Liabilities: a DECREASE in
   * liabilities is favourable (shown green with a down arrow) and an
   * INCREASE is unfavourable (shown red with an up arrow) -- the opposite
   * of Assets/Equity/Income metrics, where up is favourable. */
  readonly balanceSummaryMetrics: SummaryMetric[] = [
    {
      label: 'Total Assets',
      value: '412,600',
      icon: 'layers',
      accent: '#0033A0',
      vsBudget: '+1.2%',
      vsBudgetPositive: true,
      vsPrior: '+6.1%',
      vsPriorPositive: true,
    },
    {
      label: 'Total Liabilities',
      value: '158,800',
      icon: 'scale',
      accent: '#C0504D',
      vsBudget: '-2.2%',
      vsBudgetPositive: true,
      vsPrior: '+5.7%',
      vsPriorPositive: false,
    },
    {
      label: 'Total Equity',
      value: '253,800',
      icon: 'clock',
      accent: '#8064A2',
      vsBudget: '+3.4%',
      vsBudgetPositive: true,
      vsPrior: '+6.4%',
      vsPriorPositive: true,
    },
  ];

  readonly summaryMetrics = computed<SummaryMetric[]>(() =>
    this.activeTab() === 'balance' ? this.balanceSummaryMetrics : this.incomeSummaryMetrics(),
  );

  constructor(private readonly varianceService: VarianceService, private readonly router: Router) {}

  ngOnInit(): void {
    this.refreshIncomeStatement();
  }

  ngOnDestroy(): void {
    this.varianceSub?.unsubscribe();
    window.removeEventListener('resize', this.onResize);
  }

  backToOverview(): void {
    this.router.navigate(['/home']);
  }

  setTab(tab: StatementTab): void {
    if (tab === 'cashflow') return; // locked — no data source yet
    this.activeTab.set(tab);
  }

  setGranularity(g: Granularity): void {
    if (g !== 'Quarterly') {
      this.showToast(`${g} view is coming soon — showing Quarterly data.`);
      return;
    }
    this.granularity.set(g);
  }

  toggleExpandAll(): void {
    this.expandAll.update((v) => !v);
    this.collapsedRows.set(new Set());
  }

  isRowCollapsed(item: string): boolean {
    return this.collapsedRows().has(item);
  }

  toggleRow(item: string): void {
    this.collapsedRows.update((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  formatNumber(value: number): string {
    if (value === 0) return '—';
    const abs = Math.abs(value).toLocaleString('en-US');
    return value < 0 ? `(${abs})` : abs;
  }

  varianceColorClass(color: string | null | undefined): string {
    switch (color?.toLowerCase()) {
      case 'green':
        return 'st-color-green';
      case 'red':
        return 'st-color-red';
      default:
        return 'st-color-neutral';
    }
  }

  onFiltersChanged(): void {
    this.refreshIncomeStatement();
  }

  refreshIncomeStatement(): void {
    this.varianceSub?.unsubscribe();
    this.varianceSub = null;

    const targetPeriod = toApiPeriod(this.period());
    const comparisonPeriod = toApiPeriod(this.comparison());

    if (!targetPeriod || !comparisonPeriod || targetPeriod === comparisonPeriod) {
      this.incomeRows.set(this.mockIncomeRows());
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.incomeRows.set([]);

    this.varianceSub = this.varianceService.startVarianceAnalysis(targetPeriod, comparisonPeriod).subscribe({
      next: (data) => {
        this.incomeRows.set(data.rows.map(mapApiRowToVarianceRow));
        this.varianceSub = this.varianceService.pollVarianceAnalysis(data.analysis_id).subscribe({
          next: (poll) => {
            if (poll.status === 'ready' || poll.status === 'failed') {
              this.incomeRows.set(poll.rows.map(mapApiRowToVarianceRow));
              this.loading.set(false);
            }
            if (poll.status === 'failed') {
              this.incomeRows.set(this.mockIncomeRows());
              this.loading.set(false);
            }
          },
          error: () => {
            this.incomeRows.set(this.mockIncomeRows());
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        void extractErrorMessage(err, '');
        this.incomeRows.set(this.mockIncomeRows());
        this.loading.set(false);
      },
    });
  }

  private mockIncomeRows(): VarianceRow[] {
    return [
      {
        item: 'Revenue and other income related to sales',
        current: 285000,
        comparison: 248525,
        variance: 36475,
        varPct: '+14.7%',
        color: 'green',
        analysis: 'Combined top-line growth reflects both core pricing recovery and steady ancillary income.',
      },
      {
        item: 'Operating costs',
        current: -184400,
        comparison: -171110,
        variance: -13290,
        varPct: '-7.8%',
        color: 'red',
        analysis: 'Total operating costs grew slower than revenue, driving the gross margin expansion this period.',
      },
      {
        item: 'Operating income',
        current: 100600,
        comparison: 77415,
        variance: 23185,
        varPct: '+29.9%',
        color: 'green',
        analysis: 'Operating income growth was the strongest driver of group profitability this period.',
        isSubtotal: true,
      },
      {
        item: 'Non-operating Costs',
        current: 2800,
        comparison: 2246,
        variance: 554,
        varPct: '+24.7%',
        color: 'green',
        analysis: 'Net non-operating items were modestly favourable, adding a small uplift to pre-tax income.',
      },
      {
        item: 'Income before income taxes and zakat',
        current: 103400,
        comparison: 79661,
        variance: 23739,
        varPct: '+29.8%',
        color: 'green',
        analysis: 'Pre-tax income growth tracks closely with the operating income improvement.',
        isSubtotal: true,
      },
      {
        item: 'Income taxes and zakat (Note 7)',
        current: -31600,
        comparison: -26555,
        variance: -5045,
        varPct: '-19.0%',
        color: 'red',
        analysis: 'Effective tax and zakat rate held broadly consistent with the prior comparable period.',
      },
      {
        item: 'Net income',
        current: 71800,
        comparison: 53106,
        variance: 18694,
        varPct: '+35.2%',
        color: 'green',
        analysis: 'Net income growth outpaced revenue growth on the back of margin expansion and cost discipline.',
        isSubtotal: true,
      },
    ];
  }

  private showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(null), 3000);
  }
}