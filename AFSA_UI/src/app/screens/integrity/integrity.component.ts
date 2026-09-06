import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { ConfirmDialogComponent, ConfirmDialogSegment } from '../../shared/confirm-dialog/confirm-dialog.component';
import { IntegrityService } from '../../core/services/integrity.service';
import {
  FootingRow,
  IntegrityCheckCounts,
  IntegritySummary,
  IntegrityTableSchema,
  XRefRow,
} from '../../core/models/integrity.model';
import { AgentStatusCueComponent } from '../../shared/agent-status-cue/agent-status-cue.component';
import { SpecialistAgentComponent } from '../../shared/specialist-agent/specialist-agent.component';

type Tab = 'xref' | 'footing';

const VALID_TABS: Tab[] = ['xref', 'footing'];

const PAGE_SIZE = 10;
const EMPTY_COUNTS: IntegrityCheckCounts = { checked: 0, passed: 0, flagged: 0, completed: 0 };

type PendingCompletion =
  | { kind: 'xref'; row: XRefRow }
  | { kind: 'footing'; row: FootingRow };

@Component({
  selector: 'app-integrity',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonComponent, PaginationComponent, ConfirmDialogComponent, AgentStatusCueComponent, SpecialistAgentComponent],
  templateUrl: './integrity.component.html',
  styleUrl: './integrity.component.scss',
})
export class IntegrityComponent implements OnInit {
  readonly tab = signal<Tab>('xref');
  readonly toast = signal(false);
  readonly toastMessage = signal('');

  /* ---------- Summary (header strip) ---------- */
  readonly summary = signal<IntegritySummary | null>(null);
  readonly summaryLoading = signal(true);
  readonly summaryError = signal<string | null>(null);

  /* ---------- Schemas (fetched once, drive labels/badge tones) ---------- */
  readonly xrefSchema = signal<IntegrityTableSchema | null>(null);
  readonly footingSchema = signal<IntegrityTableSchema | null>(null);

  /* ---------- Cross-Reference tab state ---------- */
  readonly xrefRows = signal<XRefRow[]>([]);
  readonly xrefCounts = signal<IntegrityCheckCounts>(EMPTY_COUNTS);
  readonly xrefPage = signal(1);
  readonly xrefTotalPages = signal(1);
  readonly xrefLoading = signal(true);
  readonly xrefError = signal<string | null>(null);
  readonly xrefLoaded = signal(false);
  readonly expandedXrefRows = signal<Set<string>>(new Set());
  readonly markingXrefRow = signal<string | null>(null);

  /** True only while the Cross-Reference table + KPI counts are being
   *  reloaded after a "Mark Complete" action -- independent from
   *  xrefLoading(), which also covers plain pagination and the very first
   *  load. Kept separate so pagination doesn't flash the KPI cards, but a
   *  Mark Complete reload shows a skeleton on both the table and the
   *  counts, since the confirmed row's completion can shift more than
   *  just its own row (e.g. the Flagged/Completed counts). */
  readonly xrefReloading = signal(false);

  /* ---------- Footing tab state ---------- */
  readonly footingRows = signal<FootingRow[]>([]);
  readonly footingCounts = signal<IntegrityCheckCounts>(EMPTY_COUNTS);
  readonly footingPage = signal(1);
  readonly footingTotalPages = signal(1);
  readonly footingLoading = signal(true);
  readonly footingError = signal<string | null>(null);
  readonly footingLoaded = signal(false);
  readonly expandedFootingRows = signal<Set<string>>(new Set());
  readonly markingFootingRow = signal<string | null>(null);

  /** Same purpose as xrefReloading(), for the Footing tab. */
  readonly footingReloading = signal(false);

  readonly refreshing = signal(false);

  /* ---------- Mark Complete confirmation dialog ---------- */
  readonly pendingCompletion = signal<PendingCompletion | null>(null);
  readonly confirmingCompletion = signal(false);
  
  readonly totalExceptions = computed(() => this.xrefCounts().flagged + this.footingCounts().flagged);
  readonly totalChecked = computed(() => this.xrefCounts().checked + this.footingCounts().checked);

  readonly agentSummary = computed(
    () => `${this.totalExceptions()} exceptions isolated · reviewer approval may be required`,
  );

  readonly agentBriefing = computed(
    () =>
      `I completed ${this.totalChecked()} cross-reference and tie-out validations. Passing checks are already cleared automatically and ${this.totalExceptions()} unresolved exceptions remain. I'll keep tracing evidence, preparing remediation and rerunning affected checks; only changes that alter reported financial content require reviewer approval.`,
  );

  // attentionLabel/Text are undefined (hides the block) once every exception is resolved.
  readonly agentAttentionLabel = computed(() => (this.totalExceptions() > 0 ? 'Human input required' : undefined));

  readonly agentAttentionText = computed(() =>
    this.totalExceptions() > 0
      ? `${this.totalExceptions()} exceptions remain unresolved. I can continue validation and evidence tracing autonomously, but any remediation that changes reported financial content stays subject to reviewer approval.`
      : undefined,
  );

  readonly agentSuggestions = ['Review proposed remediation', 'Keep exceptions open', 'Explain the exceptions'];

  readonly pendingCompletionSegments = computed<ConfirmDialogSegment[]>(() => {
    const pending = this.pendingCompletion();
    if (!pending) return [];

    if (pending.kind === 'xref') {
      const row = pending.row;
      return [
        { text: 'Confirm that the exception for ' },
        { text: row.statementLocation, emphasis: true },
        { text: ' referencing ' },
        { text: row.referencedNote, emphasis: true },
        { text: ' has been reviewed and can be marked as complete.' },
      ];
    }

    const row = pending.row;
    return [
      { text: 'Confirm that the exception for ' },
      { text: `${row.tableSection} — ${row.location}`, emphasis: true },
      { text: ' has been reviewed and can be marked as complete.' },
    ];
  });

  /* ---------- Derived: header strip counts ---------- */
  readonly xrefChecked = computed(() => this.summary()?.checks.crossReference.checked ?? this.xrefCounts().checked);
  readonly xrefFlaggedHeader = computed(
    () => this.summary()?.checks.crossReference.flagged ?? this.xrefCounts().flagged,
  );
  readonly footingChecked = computed(() => this.summary()?.checks.footing.checked ?? this.footingCounts().checked);
  readonly footingFlaggedHeader = computed(
    () => this.summary()?.checks.footing.flagged ?? this.footingCounts().flagged,
  );

  readonly currency = computed(() => this.summary()?.document.currency ?? '');

  constructor(
    private readonly integrityService: IntegrityService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Restore whichever tab was active before a hard reload/navigation, via
    // the ?tab= query param -- otherwise this screen always snapped back to
    // Cross-Reference Check regardless of where the person was.
    const queryTab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (queryTab && VALID_TABS.includes(queryTab)) {
      this.tab.set(queryTab);
    }

    this.loadSummary();
    this.integrityService.getCrossReferenceSchema().subscribe({
      next: (schema) => this.xrefSchema.set(schema),
    });
    this.integrityService.getFootingSchema().subscribe({
      next: (schema) => this.footingSchema.set(schema),
    });
    this.loadXrefRows(1);

    // If the restored tab is Footing, that tab's own data still needs its
    // initial fetch -- loadXrefRows() above only covers Cross-Reference.
    if (this.tab() === 'footing') {
      this.loadFootingRows(1);
    }
  }

  private loadSummary(refresh = false): void {
    this.summaryLoading.set(!this.summary());
    this.summaryError.set(null);
    this.integrityService.getSummary(refresh).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
        this.summaryError.set('Unable to load the review summary.');
      },
    });
  }

  private loadXrefRows(page: number): void {
    this.xrefLoading.set(true);
    this.xrefError.set(null);
    this.integrityService.getCrossReferenceRows(page, PAGE_SIZE).subscribe({
      next: (data) => {
        this.xrefRows.set(data.items);
        this.xrefCounts.set(data.counts);
        this.xrefPage.set(data.pageNumber);
        this.xrefTotalPages.set(Math.max(1, data.totalPages));
        this.xrefLoading.set(false);
        this.xrefLoaded.set(true);
      },
      error: () => {
        this.xrefLoading.set(false);
        this.xrefLoaded.set(true);
        this.xrefError.set('Unable to load the cross-reference check. Please try again.');
      },
    });
  }

  private loadFootingRows(page: number): void {
    this.footingLoading.set(true);
    this.footingError.set(null);
    this.integrityService.getFootingRows(page, PAGE_SIZE).subscribe({
      next: (data) => {
        this.footingRows.set(data.items);
        this.footingCounts.set(data.counts);
        this.footingPage.set(data.pageNumber);
        this.footingTotalPages.set(Math.max(1, data.totalPages));
        this.footingLoading.set(false);
        this.footingLoaded.set(true);
      },
      error: () => {
        this.footingLoading.set(false);
        this.footingLoaded.set(true);
        this.footingError.set('Unable to load the footing & subfooting check. Please try again.');
      },
    });
  }

  /* ---------- Tabs ---------- */

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.syncTabQueryParam(tab);
    if (tab === 'footing' && !this.footingLoaded()) {
      this.loadFootingRows(1);
    }
  }

  /** Keeps the URL's ?tab= param in sync with the active tab so a hard
   *  reload (or a shared/bookmarked link) lands back on the same tab
   *  instead of always defaulting to Cross-Reference Check. replaceUrl
   *  avoids filling browser history with one entry per tab click. */
  private syncTabQueryParam(tab: Tab): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  goToFootingTab(): void {
    this.setTab('footing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToReports(): void {
    this.router.navigate(['/reports']);
  }

  /* ---------- Pagination ---------- */

  onXrefPageChange(page: number): void {
    this.loadXrefRows(page);
  }

  onFootingPageChange(page: number): void {
    this.loadFootingRows(page);
  }

  /* ---------- Retry ---------- */

  retryXref(): void {
    this.loadXrefRows(this.xrefPage());
  }

  retryFooting(): void {
    this.loadFootingRows(this.footingPage());
  }

  /* ---------- Re-run checks (refresh=true) ---------- */

  rerunChecks(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.loadSummary(true);
    this.integrityService.getCrossReferenceRows(this.xrefPage(), PAGE_SIZE, { refresh: true }).subscribe({
      next: (data) => {
        this.xrefRows.set(data.items);
        this.xrefCounts.set(data.counts);
        this.xrefTotalPages.set(Math.max(1, data.totalPages));
      },
    });
    if (this.footingLoaded()) {
      this.integrityService
        .getFootingRows(this.footingPage(), PAGE_SIZE, { refresh: true })
        .subscribe({
          next: (data) => {
            this.footingRows.set(data.items);
            this.footingCounts.set(data.counts);
            this.footingTotalPages.set(Math.max(1, data.totalPages));
          },
        });
    }
    window.setTimeout(() => this.refreshing.set(false), 800);
  }

  goToReportsFromToast(): void {
    this.toast.set(true);
    this.toastMessage.set('Footings & Cross-References Exception Report generated');
    window.setTimeout(() => this.toast.set(false), 3000);
  }

  generateReport(): void {
    this.goToReportsFromToast();
  }

  /* ---------- Row expand/collapse ---------- */

  isXrefExpanded(id: string): boolean {
    return this.expandedXrefRows().has(id);
  }

  toggleXrefRow(id: string): void {
    this.expandedXrefRows.update((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isFootingExpanded(id: string): boolean {
    return this.expandedFootingRows().has(id);
  }

  toggleFootingRow(id: string): void {
    this.expandedFootingRows.update((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ---------- Row helpers ---------- */

  isXrefFlagged(row: XRefRow): boolean {
    return row.status === 'Flagged';
  }

  xrefResultClass(row: XRefRow): string {
    return this.toneFor(this.xrefSchema(), 'checkResults', row.checkResult);
  }

  xrefStatusClass(row: XRefRow): string {
    return this.toneFor(this.xrefSchema(), 'statuses', row.status);
  }

  isFootingFlagged(row: FootingRow): boolean {
  if (row.status !== 'Flagged') return false;
  const tone = this.footingSchema()?.checkResults?.find((v) => v.value === row.result)?.tone;
  return tone !== 'success';
}

  footingResultClass(row: FootingRow): string {
    return this.toneFor(this.footingSchema(), 'checkResults', row.result);
  }

  footingStatusClass(row: FootingRow): string {
    return this.toneFor(this.footingSchema(), 'statuses', row.status);
  }

  /** Look up a badge's colour tone from the schema's vocab, per the API contract, never by matching text. */
  private toneFor(
    schema: IntegrityTableSchema | null,
    vocab: 'checkResults' | 'statuses',
    value: string,
  ): string {
    const entry = schema?.[vocab]?.find((v) => v.value === value);
    return entry?.tone ?? 'neutral';
  }

  /** Money formatting per the API contract: thousands separators, parentheses for negatives, em dash for null. */
  formatMoney(value: number | null): string {
    if (value === null || value === undefined) return '—';
    const abs = Math.abs(value);
    const formatted = abs.toLocaleString('en-US');
    const currency = this.currency();
    const prefixed = currency ? `${currency} ${formatted}` : formatted;
    return value < 0 ? `(${prefixed})` : prefixed;
  }

  /* ---------- Row actions: Mark Complete (routed through confirmation dialog) ---------- */

  requestMarkXRefComplete(row: XRefRow): void {
    if (this.markingXrefRow()) return;
    this.pendingCompletion.set({ kind: 'xref', row });
  }

  requestMarkFootingComplete(row: FootingRow): void {
    if (this.markingFootingRow()) return;
    this.pendingCompletion.set({ kind: 'footing', row });
  }

  cancelPendingCompletion(): void {
    if (this.confirmingCompletion()) return;
    this.pendingCompletion.set(null);
  }

  confirmPendingCompletion(): void {
    const pending = this.pendingCompletion();
    if (!pending || this.confirmingCompletion()) return;

    this.confirmingCompletion.set(true);

    const onSettled = () => {
      this.confirmingCompletion.set(false);
      this.pendingCompletion.set(null);
    };

    if (pending.kind === 'xref') {
      this.markXRefComplete(pending.row, onSettled);
    } else {
      this.markFootingComplete(pending.row, onSettled);
    }
  }

  private markXRefComplete(row: XRefRow, onSettled?: () => void): void {
    if (this.markingXrefRow()) return;
    this.markingXrefRow.set(row.lineId);
    this.integrityService.markComplete<XRefRow>('crossReference', row.lineId, true).subscribe({
      next: () => {
        this.markingXrefRow.set(null);
        this.expandedXrefRows.update((prev) => {
          const next = new Set(prev);
          next.delete(row.lineId);
          return next;
        });

        // Reload the whole table for the current page + its KPI counts,
        // rather than only patching the one confirmed row locally --
        // marking a row complete can shift the Flagged/Completed counts
        // and, in principle, other rows on the page too.
        this.xrefReloading.set(true);
        this.integrityService.getCrossReferenceRows(this.xrefPage(), PAGE_SIZE).subscribe({
          next: (data) => {
            this.xrefRows.set(data.items);
            this.xrefCounts.set(data.counts);
            this.xrefTotalPages.set(Math.max(1, data.totalPages));
            this.xrefReloading.set(false);
          },
          error: () => {
            this.xrefReloading.set(false);
          },
        });

        this.refreshSummarySilently();
        onSettled?.();
      },
      error: () => {
        this.markingXrefRow.set(null);
        onSettled?.();
      },
    });
  }

  private markFootingComplete(row: FootingRow, onSettled?: () => void): void {
    if (this.markingFootingRow()) return;
    this.markingFootingRow.set(row.lineId);
    this.integrityService.markComplete<FootingRow>('footing', row.lineId, true).subscribe({
      next: () => {
        this.markingFootingRow.set(null);
        this.expandedFootingRows.update((prev) => {
          const next = new Set(prev);
          next.delete(row.lineId);
          return next;
        });

        // Same full-page reload approach as markXRefComplete() above.
        this.footingReloading.set(true);
        this.integrityService.getFootingRows(this.footingPage(), PAGE_SIZE).subscribe({
          next: (data) => {
            this.footingRows.set(data.items);
            this.footingCounts.set(data.counts);
            this.footingTotalPages.set(Math.max(1, data.totalPages));
            this.footingReloading.set(false);
          },
          error: () => {
            this.footingReloading.set(false);
          },
        });

        this.refreshSummarySilently();
        onSettled?.();
      },
      error: () => {
        this.markingFootingRow.set(null);
        onSettled?.();
      },
    });
  }

  private refreshSummarySilently(): void {
    this.integrityService.getSummary().subscribe({ next: (data) => this.summary.set(data) });
  }

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];
}