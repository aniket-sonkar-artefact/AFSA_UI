import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import { IntegrityService } from '../../core/services/integrity.service';
import { FootingRow, XRefRow } from '../../core/models/integrity.model';

type Tab = 'xref' | 'footing';
type RowId = number;

@Component({
  selector: 'app-integrity',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './integrity.component.html',
  styleUrl: './integrity.component.scss',
})
export class IntegrityComponent implements OnInit {
  readonly tab = signal<Tab>('xref');
  readonly toast = signal(false);

  readonly xrefRows = signal<XRefRow[]>([]);
  readonly footingRows = signal<FootingRow[]>([]);

  readonly expandedXrefRows = signal<Set<RowId>>(new Set());
  readonly expandedFootingRows = signal<Set<RowId>>(new Set());

  /* ---------- Header summary (both tabs, always visible) ---------- */

  readonly xrefChecked = computed(() => this.xrefRows().length);
  readonly xrefFlagged = computed(() => this.xrefRows().filter((r) => r.status === 'Flagged' && !r.completed).length);
  readonly footingChecked = computed(() => this.footingRows().length);
  readonly footingFlagged = computed(
    () => this.footingRows().filter((r) => r.result !== 'Pass' && !r.completed).length,
  );

  /* ---------- Cross-Reference KPIs ---------- */

  readonly xrefStats = computed(() => {
    const rows = this.xrefRows();
    return {
      checked: rows.length,
      valid: rows.filter((r) => r.result === 'Reference Valid').length,
      flagged: rows.filter((r) => r.status === 'Flagged' && !r.completed).length,
      completed: rows.filter((r) => r.completed).length,
    };
  });

  /* ---------- Footing KPIs ---------- */

  readonly footingStats = computed(() => {
    const rows = this.footingRows();
    return {
      checked: rows.length,
      passed: rows.filter((r) => r.result === 'Pass').length,
      flagged: rows.filter((r) => r.result !== 'Pass' && !r.completed).length,
      completed: rows.filter((r) => r.completed).length,
    };
  });

  constructor(
    private readonly integrityService: IntegrityService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.integrityService.getXRefRows().subscribe((rows) => this.xrefRows.set(rows));
    this.integrityService.getFootingRows().subscribe((rows) => this.footingRows.set(rows));
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  goToFootingTab(): void {
    this.tab.set('footing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToReports(): void {
    this.router.navigate(['/reports']);
  }

  generateReport(): void {
    this.toast.set(true);
    window.setTimeout(() => this.toast.set(false), 3000);
  }

  /* ---------- Row expand/collapse ---------- */

  isXrefExpanded(id: RowId): boolean {
    return this.expandedXrefRows().has(id);
  }

  toggleXrefRow(id: RowId): void {
    this.expandedXrefRows.update((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isFootingExpanded(id: RowId): boolean {
    return this.expandedFootingRows().has(id);
  }

  toggleFootingRow(id: RowId): void {
    this.expandedFootingRows.update((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ---------- Row helpers ---------- */

  isXrefFlagged(row: XRefRow): boolean {
    return row.status === 'Flagged' && !row.completed;
  }

  xrefResultClass(row: XRefRow): string {
    if (row.result === 'Reference Valid') return 'success';
    if (row.result === 'Reference Mismatch') return 'danger';
    return 'warning';
  }

  isFootingFlagged(row: FootingRow): boolean {
    return row.result !== 'Pass' && !row.completed;
  }

  /* ---------- Row actions ---------- */

  markXRefComplete(id: number): void {
    this.integrityService.markXRefComplete(id).subscribe((updated) => {
      this.xrefRows.update((rows) => rows.map((r) => (r.id === id ? updated : r)));
    });
  }

  markFootingComplete(id: number): void {
    this.integrityService.markFootingComplete(id).subscribe((updated) => {
      this.footingRows.update((rows) => rows.map((r) => (r.id === id ? updated : r)));
    });
  }
}
