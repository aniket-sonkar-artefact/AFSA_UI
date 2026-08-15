import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntegrityService } from '../../core/services/integrity.service';
import { FootingRow, XRefRow } from '../../core/models/integrity.model';

type SubTab = 'xref' | 'footing';

@Component({
  selector: 'app-integrity',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './integrity.component.html',
  styleUrl: './integrity.component.scss',
})
export class IntegrityComponent implements OnInit {
  readonly subTab = signal<SubTab>('xref');

  readonly xrefRows = signal<XRefRow[]>([]);
  readonly footingRows = signal<FootingRow[]>([]);

  readonly xrefFlaggedCount = computed(() => this.xrefRows().filter((r) => r.status === 'Flagged').length);
  readonly footingFlaggedCount = computed(() => this.footingRows().filter((r) => r.status === 'Flagged').length);

  readonly xrefStats = computed(() => {
    const rows = this.xrefRows();
    return {
      checked: rows.length,
      valid: rows.filter((r) => r.result === 'Reference Valid').length,
      flagged: rows.filter((r) => r.status === 'Flagged').length,
      complete: rows.filter((r) => r.completed).length,
    };
  });

  readonly footingStats = computed(() => {
    const rows = this.footingRows();
    return {
      checked: rows.length,
      passed: rows.filter((r) => r.result === 'Pass').length,
      flagged: rows.filter((r) => r.status === 'Flagged').length,
      complete: rows.filter((r) => r.completed).length,
    };
  });

  constructor(private readonly integrityService: IntegrityService) {}

  ngOnInit(): void {
    this.integrityService.getXRefRows().subscribe((rows) => this.xrefRows.set(rows));
    this.integrityService.getFootingRows().subscribe((rows) => this.footingRows.set(rows));
  }

  selectTab(tab: SubTab) {
    this.subTab.set(tab);
  }

  resultChip(result: string) {
    if (result === 'Reference Valid' || result === 'Pass') return { color: '#065F46', bg: '#D1FAE5' };
    return { color: '#991B1B', bg: '#FEE2E2' };
  }

  markXRefComplete(id: number) {
    this.integrityService.markXRefComplete(id).subscribe((updated) => {
      this.xrefRows.update((rows) => rows.map((r) => (r.id === id ? updated : r)));
    });
  }

  markFootingComplete(id: number) {
    this.integrityService.markFootingComplete(id).subscribe((updated) => {
      this.footingRows.update((rows) => rows.map((r) => (r.id === id ? updated : r)));
    });
  }
}
