import { Component, OnDestroy, AfterViewInit, ElementRef, QueryList, ViewChildren, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { IconComponent } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import {
  VarianceService,
  buildRowHierarchy,
  fromApiPeriod,
  toApiPeriod,
} from '../../core/services/variance.service';
import { FinancialInsightsApiResponse, StatementType, VarianceRow } from '../../core/models/variance.model';
import { AgentStatusCueComponent } from '../../shared/agent-status-cue/agent-status-cue.component';
import { SpecialistAgentComponent } from '../../shared/specialist-agent/specialist-agent.component';
import { SelectComponent } from '../../shared/select/select.component';

/* =========================================================
   NOTE ON THIS COMPONENT
   ---------------------------------------------------------
   Reached only via the "View Group Financial Statements" CTA
   card on the Home/Overview screen (not a sidebar nav item).

   Data sourcing:
   - Income Statement AND Balance Sheet tabs: both call the real
     group-variance-analysis endpoint (statement_type swaps between
     them). The endpoint is synchronous -- the full row tree with
     commentary comes back in the same POST response, so there is
     no polling here (unlike Management Report generation).
   - Row hierarchy/expand-collapse: driven by the API's real
     parent_row_id / is_expandable fields via buildRowHierarchy(),
     not name-based guessing.
   - "vs. Budget" figures on the 3 summary cards: no budget-
     comparison endpoint exists anywhere in this app yet, so these
     stay presentation-only mock values pending a real integration.
   - "vs. Prior Period" figures on the 3 summary cards: real,
     derived directly from the same variance rows as the table.
   - Cash Flow Statement tab: intentionally locked/disabled,
     matching the approved design (no data source planned yet).
   - Monthly / Yearly period granularity: the underlying API only
     supports quarter-labelled periods (e.g. "Q1 2026"), so those
     two options show a "coming soon" toast rather than silently
     returning wrong data.
   - If the API call fails (or the two selected periods are the
     same, which the API rejects), each tab falls back to a small
     mock row set matching the approved design's figures, converted
     into the same VarianceRow shape as real data.
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

/** Converts a flat, pre-Figma mock row (no real hierarchy) into the same
 *  VarianceRow shape real API data uses, so the table/summary-card logic
 *  doesn't need a separate code path for the fallback case. */
function mockRow(
  item: string,
  current: number,
  comparison: number,
  variance: number,
  varPct: string,
  color: 'green' | 'red' | 'neutral',
  analysis: string,
  isSubtotal = false,
): VarianceRow {
  return {
    rowId: item.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    parentRowId: null,
    rowType: isSubtotal ? 'subtotal' : 'line_item',
    item,
    noteReference: null,
    isExpandable: false,
    depth: 0,
    current,
    comparison,
    variance,
    varPct,
    color,
    analysis,
    isSubtotal,
  };
}

const INCOME_STATEMENT_MOCK: VarianceRow[] = [
  mockRow('Revenue and other income related to sales', 285000, 248525, 36475, '+14.7%', 'green', 'Combined top-line growth reflects both core pricing recovery and steady ancillary income.'),
  mockRow('Operating costs', -184400, -171110, -13290, '-7.8%', 'red', 'Total operating costs grew slower than revenue, driving the gross margin expansion this period.'),
  mockRow('Operating income', 100600, 77415, 23185, '+29.9%', 'green', 'Operating income growth was the strongest driver of group profitability this period.', true),
  mockRow('Non-operating Costs', 2800, 2246, 554, '+24.7%', 'green', 'Net non-operating items were modestly favourable, adding a small uplift to pre-tax income.'),
  mockRow('Income before income taxes and zakat', 103400, 79661, 23739, '+29.8%', 'green', 'Pre-tax income growth tracks closely with the operating income improvement.', true),
  mockRow('Income taxes and zakat (Note 7)', -31600, -26555, -5045, '-19.0%', 'red', 'Effective tax and zakat rate held broadly consistent with the prior comparable period.'),
  mockRow('Net income', 71800, 53106, 18694, '+35.2%', 'green', 'Net income growth outpaced revenue growth on the back of margin expansion and cost discipline.', true),
];

const BALANCE_SHEET_MOCK: VarianceRow[] = [
  mockRow('Cash and cash equivalents', 45200, 42350, 2850, '+6.7%', 'green', 'Cash position improved on stronger operating collections.'),
  mockRow('Trade receivables', 96500, 88250, 8250, '+9.3%', 'red', 'Higher receivables balance carried from Q4 close.'),
  mockRow('Total current assets', 187300, 172100, 15200, '+8.8%', 'green', 'Growth driven by cash and receivables balances.', true),
  mockRow('Property, plant and equipment', 412600, 405900, 6700, '+1.7%', 'green', 'Modest capex additions during the period.'),
  mockRow('Total assets', 599900, 578000, 21900, '+3.8%', 'green', 'Overall balance sheet growth in line with operations.', true),
  mockRow('Trade payables', 74300, 71800, 2500, '+3.5%', 'red', 'Payables grew broadly in line with purchasing volumes.'),
  mockRow('Total liabilities', 265400, 258100, 7300, '+2.8%', 'red', 'Liability growth remains below asset growth.', true),
  mockRow("Total shareholders' equity", 334500, 319900, 14600, '+4.6%', 'green', 'Equity growth driven by retained period earnings.', true),
];

const PERIOD_OPTIONS: string[] = [
  'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024',
  'Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025',
  'Q1 2026',
];

@Component({
  selector: 'app-statements',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, SkeletonComponent, AgentStatusCueComponent, SpecialistAgentComponent, SelectComponent],
  templateUrl: './statements.component.html',
  styleUrl: './statements.component.scss',
})
export class StatementsComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('tabBtn') private readonly tabBtnRefs!: QueryList<ElementRef<HTMLButtonElement>>;
  @ViewChildren('granBtn') private readonly granBtnRefs!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly periodOptions = signal<string[]>([]);
  private readonly tabRects = signal<{ left: number; width: number }[]>([]);
  private readonly granRects = signal<{ left: number; width: number }[]>([]);

  readonly agentContextLabel = computed(() => {
  const statementLabel = this.activeTab() === 'balance' ? 'Balance Sheet' : 'Income Statement';
    return `${statementLabel} · ${this.period()} vs ${this.comparison()}`;
  });

  readonly agentBriefing =
    'I reviewed the income statement and identified 8 material variances. 6 are supported by the available financial and business-driver evidence. 2 movements still require management context before I finalize the commentary.';

  readonly agentSummary = '6 explained · 2 need management context';

  readonly agentSuggestions = [
    'Show the unresolved movements',
    'Explain what input you need',
    'Keep unresolved commentary open',
  ];

  readonly agentAttentionText =
    '2 material income-statement movements do not have sufficient business-driver context. I will keep their commentary open while the remaining explained variances continue downstream.';

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

  private loadPeriodOptions(): void {
    this.periodOptions.set(PERIOD_OPTIONS);
  }

  private measureIndicators(): void {
    this.tabRects.set(
      this.tabBtnRefs.toArray().map((ref) => ({ left: ref.nativeElement.offsetLeft, width: ref.nativeElement.offsetWidth })),
    );
    this.granRects.set(
      this.granBtnRefs.toArray().map((ref) => ({ left: ref.nativeElement.offsetLeft, width: ref.nativeElement.offsetWidth })),
    );
  }

  ngAfterViewInit(): void {
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
  readonly balanceRows = signal<VarianceRow[]>([]);
  readonly incomeLoading = signal(true);
  readonly balanceLoading = signal(true);

  /** Tracks which "period|comparison" combo each tab's data was last
   *  fetched for, so switching tabs doesn't refetch unless the filters
   *  actually changed since that tab was last loaded. */
  private incomeLoadedKey: string | null = null;
  private balanceLoadedKey: string | null = null;

  private get filterKey(): string {
    return `${this.period()}|${this.comparison()}`;
  }

  readonly loading = computed(() => (this.activeTab() === 'balance' ? this.balanceLoading() : this.incomeLoading()));

  /** Full hierarchical row set for whichever tab is active (flattened,
   *  parent-before-children order, with depth already computed). */
  readonly activeRows = computed<VarianceRow[]>(() =>
    this.activeTab() === 'balance' ? this.balanceRows() : this.incomeRows(),
  );

  /** activeRows filtered so a collapsed row's descendants (at any depth) are
   *  hidden. Safe to compute in a single forward pass because
   *  buildRowHierarchy already guarantees parent-before-children order. */
  readonly visibleRows = computed<VarianceRow[]>(() => {
    const rows = this.activeRows();
    const collapsed = this.collapsedRows();
    const hiddenParents = new Set<string>();
    const result: VarianceRow[] = [];

    for (const row of rows) {
      if (row.parentRowId && hiddenParents.has(row.parentRowId)) {
        hiddenParents.add(row.rowId); // propagate hidden state to this row's own children too
        continue;
      }
      result.push(row);
      if (row.isExpandable && collapsed.has(row.rowId)) {
        hiddenParents.add(row.rowId);
      }
    }
    return result;
  });

  private findRow(predicate: (r: VarianceRow) => boolean): VarianceRow | undefined {
    return this.activeRows().find(predicate);
  }

  private readonly revenueRow = computed(() => this.incomeRows().find((r) => r.item.toLowerCase().includes('revenue')));
  private readonly operatingIncomeRow = computed(() => this.incomeRows().find((r) => r.item.toLowerCase() === 'operating income'));
  private readonly netIncomeRow = computed(() => this.incomeRows().find((r) => r.item.toLowerCase() === 'net income'));

  private readonly totalAssetsRow = computed(() =>
    this.balanceRows().find((r) => r.rowId === 'total_assets'),
  );
  private readonly totalLiabilitiesRow = computed(() =>
    this.balanceRows().find((r) => r.rowId === 'total_liabilities'),
  );
  private readonly totalEquityRow = computed(() =>
    this.balanceRows().find((r) => r.rowId === 'Equity_total'),
  );

  readonly incomeSummaryMetrics = computed<SummaryMetric[]>(() => [
    {
      label: 'Revenue',
      value: this.formatNumber(this.revenueRow()?.current ?? 0),
      icon: 'camera',
      accent: '#0033A0',
      vsBudget: '+4.8%',
      vsBudgetPositive: true,
      vsPrior: this.revenueRow()?.varPct ?? '—',
      vsPriorPositive: (this.revenueRow()?.color ?? 'neutral') !== 'red',
    },
    {
      label: 'Operating Income',
      value: this.formatNumber(this.operatingIncomeRow()?.current ?? 0),
      icon: 'trending-up',
      accent: '#00A3E0',
      vsBudget: '+4.2%',
      vsBudgetPositive: true,
      vsPrior: this.operatingIncomeRow()?.varPct ?? '—',
      vsPriorPositive: (this.operatingIncomeRow()?.color ?? 'neutral') !== 'red',
    },
    {
      label: 'Net Income',
      value: this.formatNumber(this.netIncomeRow()?.current ?? 0),
      icon: 'dollar',
      accent: '#00843D',
      vsBudget: '+4.5%',
      vsBudgetPositive: true,
      vsPrior: this.netIncomeRow()?.varPct ?? '—',
      vsPriorPositive: (this.netIncomeRow()?.color ?? 'neutral') !== 'red',
    },
  ]);

  /* Balance Sheet has its own headline metrics (Total Assets / Total
   * Liabilities / Total Equity) now sourced from real rows when available.
   * "vs. Budget" stays mock -- no budget endpoint exists.
   *
   * Note the inverted "good direction" for Total Liabilities: a DECREASE is
   * favourable there, the opposite of Assets/Equity. */
  readonly balanceSummaryMetrics = computed<SummaryMetric[]>(() => [
    {
      label: 'Total Assets',
      value: this.formatNumber(this.totalAssetsRow()?.current ?? 0),
      icon: 'layers',
      accent: '#0033A0',
      vsBudget: '+1.2%',
      vsBudgetPositive: true,
      vsPrior: this.totalAssetsRow()?.varPct ?? '—',
      vsPriorPositive: (this.totalAssetsRow()?.color ?? 'neutral') !== 'red',
    },
    {
      label: 'Total Liabilities',
      value: this.formatNumber(this.totalLiabilitiesRow()?.current ?? 0),
      icon: 'scale',
      accent: '#C0504D',
      vsBudget: '-2.2%',
      vsBudgetPositive: true,
      vsPrior: this.totalLiabilitiesRow()?.varPct ?? '—',
      vsPriorPositive: (this.totalLiabilitiesRow()?.color ?? 'neutral') === 'red', // inverted: liabilities decreasing is good
    },
    {
      label: 'Total Equity',
      value: this.formatNumber(this.totalEquityRow()?.current ?? 0),
      icon: 'clock',
      accent: '#8064A2',
      vsBudget: '+3.4%',
      vsBudgetPositive: true,
      vsPrior: this.totalEquityRow()?.varPct ?? '—',
      vsPriorPositive: (this.totalEquityRow()?.color ?? 'neutral') !== 'red',
    },
  ]);

  readonly summaryMetrics = computed<SummaryMetric[]>(() =>
    this.activeTab() === 'balance' ? this.balanceSummaryMetrics() : this.incomeSummaryMetrics(),
  );

  constructor(private readonly varianceService: VarianceService, private readonly router: Router) {
    this.loadPeriodOptions();
    this.fetchStatement('income');
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
    this.collapsedRows.set(new Set()); // fresh row set, fresh collapse state
    if (tab === 'balance' && this.balanceLoadedKey !== this.filterKey) {
      this.fetchStatement('balance');
    }
  }

  setGranularity(g: Granularity): void {
    if (g !== 'Quarterly') {
      this.showToast(`${g} view is coming soon — showing Quarterly data.`);
      return;
    }
    this.granularity.set(g);
  }

  toggleExpandAll(): void {
    const next = !this.expandAll();
    this.expandAll.set(next);
    if (next) {
      this.collapsedRows.set(new Set());
    } else {
      this.collapsedRows.set(new Set(this.activeRows().filter((r) => r.isExpandable).map((r) => r.rowId)));
    }
  }

  isRowCollapsed(rowId: string): boolean {
    return this.collapsedRows().has(rowId);
  }

  toggleRow(rowId: string): void {
    this.collapsedRows.update((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
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
    // Period changed -- both tabs' caches are now stale. Only refetch the
    // one currently on screen; the other lazily refetches on next selection.
    this.incomeLoadedKey = null;
    this.balanceLoadedKey = null;
    this.fetchStatement(this.activeTab() === 'balance' ? 'balance' : 'income');
  }

  private fetchStatement(tab: 'income' | 'balance'): void {
    this.varianceSub?.unsubscribe();
    this.varianceSub = null;

    const statementType: StatementType = tab === 'balance' ? 'balance_sheet' : 'income_statement';
    const targetPeriod = toApiPeriod(this.period());
    const comparisonPeriod = toApiPeriod(this.comparison());
    const setLoading = tab === 'balance' ? this.balanceLoading : this.incomeLoading;
    const setRows = tab === 'balance' ? this.balanceRows : this.incomeRows;
    const mock = tab === 'balance' ? BALANCE_SHEET_MOCK : INCOME_STATEMENT_MOCK;

    // Clear stale rows immediately so the skeleton actually shows instead of
    // the previous period's data sitting there until the new response lands.
    setRows.set([]);
    this.collapsedRows.set(new Set());

    if (!targetPeriod || !comparisonPeriod || targetPeriod === comparisonPeriod) {
      setRows.set(mock);
      this.collapseAllExpandable(mock);
      setLoading.set(false);
      return;
    }

    setLoading.set(true);

    this.varianceSub = this.varianceService.getVarianceAnalysis(statementType, targetPeriod, comparisonPeriod).subscribe({
      next: (data) => {
        const rows = buildRowHierarchy(data.rows);
        setRows.set(rows);
        this.collapseAllExpandable(rows);
        this.currency.set(`${data.currency} (${data.unit === 'thousands' ? '000s' : data.unit})`);
        this.period.set(fromApiPeriod(data.target_period));
        this.comparison.set(fromApiPeriod(data.comparison_period));
        if (tab === 'balance') this.balanceLoadedKey = this.filterKey;
        else this.incomeLoadedKey = this.filterKey;
        setLoading.set(false);
      },
      error: (err) => {
        void extractErrorMessage(err, '');
        setRows.set(mock);
        this.collapseAllExpandable(mock);
        setLoading.set(false);
      },
    });
  }

  private showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(null), 3000);
  }

  /** Collapses every expandable row in a freshly loaded row set — the
   * default state whenever the page or a new statement/period first loads. */
  private collapseAllExpandable(rows: VarianceRow[]): void {
    this.collapsedRows.set(new Set(rows.filter((r) => r.isExpandable).map((r) => r.rowId)));
    this.expandAll.set(false);
  }
}