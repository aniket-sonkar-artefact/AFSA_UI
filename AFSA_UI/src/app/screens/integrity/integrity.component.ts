import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { IntegrityService } from '../../core/services/integrity.service';
import {
  FootingRow,
  IntegrityCheckCounts,
  IntegritySummary,
  IntegrityTableSchema,
  XRefRow,
} from '../../core/models/integrity.model';

type Tab = 'xref' | 'footing';

const PAGE_SIZE = 10;
const EMPTY_COUNTS: IntegrityCheckCounts = { checked: 0, passed: 0, flagged: 0, completed: 0 };

@Component({
  selector: 'app-integrity',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonComponent, PaginationComponent],
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

  readonly refreshing = signal(false);

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
  ) {}

  ngOnInit(): void {
    this.loadSummary();
    this.integrityService.getCrossReferenceSchema().subscribe({
      next: (schema) => this.xrefSchema.set(schema),
    });
    this.integrityService.getFootingSchema().subscribe({
      next: (schema) => this.footingSchema.set(schema),
    });
    this.loadXrefRows(1);
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
    if (tab === 'footing' && !this.footingLoaded()) {
      this.loadFootingRows(1);
    }
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
    return row.status === 'Flagged';
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

  /* ---------- Row actions ---------- */

  markXRefComplete(row: XRefRow): void {
    if (this.markingXrefRow()) return;
    this.markingXrefRow.set(row.lineId);
    this.integrityService.markComplete<XRefRow>('crossReference', row.lineId, true).subscribe({
      next: ({ row: updated, counts }) => {
        this.xrefRows.update((rows) => rows.map((r) => (r.lineId === updated.lineId ? updated : r)));
        this.xrefCounts.set(counts);
        this.markingXrefRow.set(null);
        this.expandedXrefRows.update((prev) => {
          const next = new Set(prev);
          next.delete(updated.lineId);
          return next;
        });
        this.refreshSummarySilently();
      },
      error: () => {
        this.markingXrefRow.set(null);
      },
    });
  }

  markFootingComplete(row: FootingRow): void {
    if (this.markingFootingRow()) return;
    this.markingFootingRow.set(row.lineId);
    this.integrityService.markComplete<FootingRow>('footing', row.lineId, true).subscribe({
      next: ({ row: updated, counts }) => {
        this.footingRows.update((rows) => rows.map((r) => (r.lineId === updated.lineId ? updated : r)));
        this.footingCounts.set(counts);
        this.markingFootingRow.set(null);
        this.expandedFootingRows.update((prev) => {
          const next = new Set(prev);
          next.delete(updated.lineId);
          return next;
        });
        this.refreshSummarySilently();
      },
      error: () => {
        this.markingFootingRow.set(null);
      },
    });
  }

  private refreshSummarySilently(): void {
    this.integrityService.getSummary().subscribe({ next: (data) => this.summary.set(data) });
  }

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];
}
