import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubmissionReviewService, GROUP_ACCOUNTS } from '../../core/services/submission-review.service';
import { Affiliate, ChecklistGroup, ChecklistStatus, CoaRow, Finding, FindingStatus } from '../../core/models/submission-review.model';

type MainTab = 'completeness' | 'irregularities' | 'coa';

const TAB_LABEL: Record<MainTab, string> = {
  completeness: 'Completeness Review',
  irregularities: 'Irregularities Review',
  coa: 'CoA Mapping Review',
};

@Component({
  selector: 'app-submission-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './submission-review.component.html',
  styleUrl: './submission-review.component.scss',
})
export class SubmissionReviewComponent implements OnInit {
  readonly groupAccounts = GROUP_ACCOUNTS;
  readonly tabLabel = TAB_LABEL;
  readonly tabs: MainTab[] = ['completeness', 'irregularities', 'coa'];
  readonly affiliates: Affiliate[] = ['A', 'B'];

  readonly affiliate = signal<Affiliate>('A');
  readonly tab = signal<MainTab>('completeness');

  readonly checklist = signal<ChecklistGroup[]>([]);
  readonly findings = signal<Finding[]>([]);
  readonly coaRows = signal<CoaRow[]>([]);

  readonly checklistCounts = computed(() => {
    const allItems = this.checklist().flatMap((g) => g.items);
    return {
      Complete: allItems.filter((i) => i.status === 'Complete').length,
      Incomplete: allItems.filter((i) => i.status === 'Incomplete').length,
      Missing: allItems.filter((i) => i.status === 'Missing').length,
      'Not Applicable': allItems.filter((i) => i.status === 'Not Applicable').length,
    } as Record<ChecklistStatus, number>;
  });

  readonly checklistStatCards = computed(() => {
    const counts = this.checklistCounts();
    return [
      { label: 'Complete' as ChecklistStatus, value: counts.Complete, color: '#065F46' },
      { label: 'Incomplete' as ChecklistStatus, value: counts.Incomplete, color: '#92400E' },
      { label: 'Missing' as ChecklistStatus, value: counts.Missing, color: '#991B1B' },
      { label: 'Not Applicable' as ChecklistStatus, value: counts['Not Applicable'], color: '#475569' },
    ];
  });

  readonly coaHasBlockers = computed(() =>
    this.coaRows().some((r) => !r.confirmed && (r.originalStatus === 'Low Confidence' || r.originalStatus === 'Unmapped')),
  );

  constructor(private readonly submissionReviewService: SubmissionReviewService) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll() {
    const aff = this.affiliate();
    this.submissionReviewService.getChecklist(aff).subscribe((c) => this.checklist.set(c));
    this.submissionReviewService.getFindings(aff).subscribe((f) => this.findings.set(f));
    this.submissionReviewService.getCoaRows(aff).subscribe((c) => this.coaRows.set(c));
  }

  selectAffiliate(aff: Affiliate) {
    this.affiliate.set(aff);
    this.loadAll();
  }

  selectTab(tab: MainTab) {
    this.tab.set(tab);
  }

  statusStyle(status: ChecklistStatus) {
    const map: Record<ChecklistStatus, { color: string; bg: string }> = {
      Complete: { color: '#065F46', bg: '#D1FAE5' },
      Incomplete: { color: '#92400E', bg: '#FEF3C7' },
      Missing: { color: '#991B1B', bg: '#FEE2E2' },
      'Not Applicable': { color: 'var(--text-secondary)', bg: '#F1F5F9' },
    };
    return map[status];
  }

  findingStatusStyle(status: FindingStatus) {
    if (status === 'Open') return { color: '#92400E', bg: '#FEF3C7' };
    if (status === 'Investigate') return { color: '#1E40AF', bg: '#DBEAFE' };
    return { color: '#065F46', bg: '#D1FAE5' };
  }

  flagCellStyle(active: boolean, severity: 'High' | 'Medium') {
    if (!active) return {};
    return {
      background: severity === 'High' ? '#FEE2E2' : '#FEF3C7',
      color: severity === 'High' ? '#991B1B' : '#92400E',
      'font-weight': 700,
    };
  }

  mappingStatusChip(status: string) {
    if (status === 'Confirmed' || status === 'High Confidence') return { color: '#065F46', bg: '#D1FAE5', border: '#BBF7D0' };
    if (status === 'Low Confidence') return { color: '#991B1B', bg: '#FEE2E2', border: '#FECACA' };
    return { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
  }

  onFindingStatusChange(index: number, status: FindingStatus) {
    this.submissionReviewService.updateFindingStatus(this.affiliate(), index, status).subscribe((updated) => {
      this.findings.update((rows) => rows.map((r, i) => (i === index ? updated : r)));
    });
  }

  onCoaMappingChange(index: number, value: string) {
    this.submissionReviewService.updateCoaMapping(this.affiliate(), index, value).subscribe((updated) => {
      this.coaRows.update((rows) => rows.map((r, i) => (i === index ? updated : r)));
    });
  }

  confirmCoaMapping(index: number) {
    this.submissionReviewService.confirmCoaMapping(this.affiliate(), index).subscribe((updated) => {
      this.coaRows.update((rows) => rows.map((r, i) => (i === index ? updated : r)));
    });
  }

  canConfirm(row: CoaRow): boolean {
    const isHigh = row.originalStatus === 'High Confidence';
    return !row.confirmed && (isHigh || row.originalStatus === 'Low Confidence' || row.selectedMapping !== '');
  }
}
