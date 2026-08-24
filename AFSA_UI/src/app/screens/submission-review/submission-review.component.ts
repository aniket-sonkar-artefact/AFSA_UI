import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import { AuthService } from '../../core/services/auth.service';
import { SubmissionReviewService, GROUP_ACCOUNTS } from '../../core/services/submission-review.service';
import {
  Affiliate,
  ChecklistGroup,
  ChecklistStatus,
  CoaRow,
  Finding,
  FindingStatus,
  UploadState,
} from '../../core/models/submission-review.model';

type MainTab = 'completeness' | 'irregularities' | 'coa';

const TAB_LABEL: Record<MainTab, string> = {
  completeness: 'Completeness Review',
  irregularities: 'Irregularities Review',
  coa: 'CoA Mapping Review',
};

@Component({
  selector: 'app-submission-review',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
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

  readonly collapsedGroups = signal<Record<string, boolean>>({});
  readonly uploads = signal<Record<string, UploadState>>({});

  readonly reviewerName = computed(() => this.authService.currentUser()?.name ?? 'Aniket Sonkar');

  /* ---------- Completeness KPIs ---------- */

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
      { label: 'Complete', value: counts.Complete, color: 'var(--submission-success)', attention: false },
      { label: 'Incomplete', value: counts.Incomplete, color: 'var(--submission-warning)', attention: false },
      { label: 'Missing', value: counts.Missing, color: 'var(--submission-danger)', attention: counts.Missing > 0 },
      { label: 'Not Applicable', value: counts['Not Applicable'], color: 'var(--submission-neutral)', attention: false },
    ];
  });

  /* ---------- Irregularities KPIs ---------- */

  readonly irregularitiesStatCards = computed(() => {
    const rows = this.findings();
    const total = rows.length;
    const highPriority = rows.filter((r) => r.severity === 'High' && r.status !== 'Closed').length;
    const investigating = rows.filter((r) => r.status === 'Investigate').length;
    const closed = rows.filter((r) => r.status === 'Closed').length;
    return [
      { label: 'Total Irregularities', value: total, color: 'var(--submission-accent)', attention: false },
      { label: 'High Priority Open', value: highPriority, color: 'var(--submission-danger)', attention: highPriority > 0 },
      { label: 'Under Investigation', value: investigating, color: 'var(--submission-info)', attention: false },
      { label: 'Closed', value: closed, color: 'var(--submission-success)', attention: false },
    ];
  });

  /* ---------- CoA KPIs ---------- */

  readonly coaStatCards = computed(() => {
    const rows = this.coaRows();
    const total = rows.length;
    const confirmed = rows.filter((r) => r.confirmed).length;
    const lowConfidencePending = rows.filter((r) => !r.confirmed && r.originalStatus === 'Low Confidence').length;
    const unmappedPending = rows.filter((r) => !r.confirmed && r.originalStatus === 'Unmapped').length;
    return [
      { label: 'Accounts Reviewed', value: total, color: 'var(--submission-accent)', attention: false },
      { label: 'Mappings Confirmed', value: confirmed, color: 'var(--submission-success)', attention: false },
      { label: 'Low Confidence Pending', value: lowConfidencePending, color: 'var(--submission-warning)', attention: false },
      { label: 'Unmapped Pending', value: unmappedPending, color: 'var(--submission-danger)', attention: unmappedPending > 0 },
    ];
  });

  readonly coaHasBlockers = computed(() =>
    this.coaRows().some((r) => !r.confirmed && (r.originalStatus === 'Low Confidence' || r.originalStatus === 'Unmapped')),
  );

  constructor(
    private readonly submissionReviewService: SubmissionReviewService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

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
    this.uploads.set({});
    this.collapsedGroups.set({});
    this.loadAll();
  }

  onAffiliateSelectChange(value: string) {
    this.selectAffiliate(value as Affiliate);
  }

  selectTab(tab: MainTab) {
    this.tab.set(tab);
  }

  goToTab(tab: MainTab) {
    this.tab.set(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToCompliance() {
    this.router.navigate(['/ifrs']);
  }

  toggleGroup(group: string) {
    this.collapsedGroups.update((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  isCollapsed(group: string): boolean {
    return Boolean(this.collapsedGroups()[group]);
  }

  /* ---------- Style helpers ---------- */

  statusStyle(status: ChecklistStatus) {
    const map: Record<ChecklistStatus, { color: string; background: string; border: string }> = {
      Complete: { color: 'var(--submission-success)', background: 'var(--submission-success-soft)', border: 'var(--submission-success-border)' },
      Incomplete: { color: 'var(--submission-warning)', background: 'var(--submission-warning-soft)', border: 'var(--submission-warning-border)' },
      Missing: { color: 'var(--submission-danger)', background: 'var(--submission-danger-soft)', border: 'var(--submission-danger-border)' },
      'Not Applicable': { color: 'var(--submission-neutral)', background: 'var(--submission-neutral-soft)', border: 'var(--submission-neutral-border)' },
    };
    return map[status];
  }

  findingStatusStyle(status: FindingStatus) {
    if (status === 'Open') return { color: 'var(--submission-warning)', background: 'var(--submission-warning-soft)', border: 'var(--submission-warning-border)' };
    if (status === 'Investigate') return { color: 'var(--submission-info)', background: 'var(--submission-info-soft)', border: 'var(--submission-info-border)' };
    return { color: 'var(--submission-success)', background: 'var(--submission-success-soft)', border: 'var(--submission-success-border)' };
  }

  mappingStatusChip(status: string) {
    if (status === 'Confirmed' || status === 'High Confidence') return { color: 'var(--submission-success)', background: 'var(--submission-success-soft)', border: 'var(--submission-success-border)' };
    if (status === 'Low Confidence') return { color: 'var(--submission-warning)', background: 'var(--submission-warning-soft)', border: 'var(--submission-warning-border)' };
    return { color: 'var(--submission-danger)', background: 'var(--submission-danger-soft)', border: 'var(--submission-danger-border)' };
  }

  flagClass(active: boolean, severity: 'High' | 'Medium'): string {
    if (!active) return '';
    return severity === 'High' ? 'flag-high' : 'flag-medium';
  }

  /* ---------- Row actions ---------- */

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

  /* ---------- Upload (mocked, swap-ready — see SubmissionReviewService.simulateFileUpload) ---------- */

  uploadKey(group: string, itemLabel: string): string {
    return `${this.affiliate()}:${group}:${itemLabel}`;
  }

  uploadState(key: string): UploadState {
    return this.uploads()[key] ?? { phase: 'idle', progress: 0, filename: '' };
  }

  onFileSelected(event: Event, key: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.startUpload(key, file.name);
  }

  private startUpload(key: string, filename: string) {
    this.uploads.update((prev) => ({ ...prev, [key]: { phase: 'uploading', progress: 0, filename } }));
    this.submissionReviewService.simulateFileUpload().subscribe({
      next: ({ progress, done }) => {
        this.uploads.update((prev) => ({
          ...prev,
          [key]: { phase: done ? 'done' : 'uploading', progress, filename },
        }));
      },
      error: () => {
        this.uploads.update((prev) => ({ ...prev, [key]: { phase: 'error', progress: 0, filename } }));
      },
    });
  }
}
