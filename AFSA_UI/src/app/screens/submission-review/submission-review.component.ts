import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { AuthService } from '../../core/services/auth.service';
import { SubmissionReviewService } from '../../core/services/submission-review.service';
import {
  ChecklistGroup,
  ChecklistStatus,
  CoaAffiliate,
  CoaGroupNode,
  CoaRow,
  CoaSchema,
  CoaSummary,
  FinanceAffiliate,
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

const PERIOD_LABEL = 'Q1 2026';

@Component({
  selector: 'app-submission-review',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, SkeletonComponent, PaginationComponent],
  templateUrl: './submission-review.component.html',
  styleUrl: './submission-review.component.scss',
})
export class SubmissionReviewComponent implements OnInit {
  readonly tabLabel = TAB_LABEL;
  readonly tabs: MainTab[] = ['completeness', 'irregularities', 'coa'];
  readonly periodLabel = PERIOD_LABEL;
  readonly displayPeriod = computed(() => this.tab() === 'coa' ? (this.coaSummary()?.session.periodLabel ?? PERIOD_LABEL) : PERIOD_LABEL);

  readonly financeAffiliates = signal<FinanceAffiliate[]>([]);
  readonly coaAffiliates = signal<CoaAffiliate[]>([]);

  // Each tab that has its own affiliate dropdown gets its OWN affiliate
  // signal, so switching affiliate on one tab never affects another tab's
  // selection or data.
  readonly completenessAffiliate = signal<string>('');
  readonly irregularitiesAffiliate = signal<string>('');
  readonly coaAffiliate = signal<string>('');

  readonly tab = signal<MainTab>('completeness');

  readonly checklist = signal<ChecklistGroup[]>([]);
  readonly findings = signal<Finding[]>([]);
  readonly coaRows = signal<CoaRow[]>([]);
  readonly coaSchema = signal<CoaSchema | null>(null);
  readonly coaSummary = signal<CoaSummary | null>(null);

  // Default to true so the skeleton renders immediately on first paint,
  // instead of briefly showing the "loaded but empty" state (0 counts,
  // "No completeness data returned for .") before the first fetch for
  // that tab has even started.
  readonly completenessLoading = signal(true);
  readonly irregularitiesLoading = signal(true);
  readonly coaLoading = signal(true);
  readonly affiliateLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly irregularitiesPage = signal(1);
  readonly irregularitiesTotalPages = signal(1);
  readonly irregularitiesTotalCount = signal(0);
  readonly coaPage = signal(1);
  readonly coaTotalPages = signal(1);

  readonly collapsedGroups = signal<Record<string, boolean>>({});
  readonly uploads = signal<Record<string, UploadState>>({});
  readonly findingStatusOverrides = signal<Record<string, FindingStatus>>({});
  readonly confirmedCoaRows = signal<Set<string>>(new Set());

  // -----------------------------------------------------------------------
  // Tab load cache: tracks which affiliate's data has already been fetched
  // for each tab, so revisiting a tab (without changing affiliate) does not
  // refetch. Keyed by affiliate identifier (entityCode / coa key).
  // -----------------------------------------------------------------------
  private readonly completenessLoadedFor = new Set<string>();
  private readonly irregularitiesLoadedFor = new Set<string>();
  private readonly coaLoadedFor = new Set<string>();

  readonly reviewerName = computed(() => this.authService.currentUser()?.name ?? 'Aniket Sonkar');

  readonly activeAffiliateName = computed(() => {
    if (this.tab() === 'coa') {
      return this.coaAffiliates().find((a) => a.key === this.coaAffiliate())?.name ?? this.coaAffiliate();
    }
    const code = this.tab() === 'irregularities' ? this.irregularitiesAffiliate() : this.completenessAffiliate();
    return this.financeAffiliates().find((a) => a.entityCode === code)?.entityName ?? code;
  });

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

  readonly irregularitiesStatCards = computed(() => {
    const rows = this.findings();
    const total = this.irregularitiesTotalCount();
    const highPriority = rows.filter((r) => r.severityColor === 'red' && r.status !== 'Closed').length;
    const investigating = rows.filter((r) => r.status === 'Investigate').length;
    const closed = rows.filter((r) => r.status === 'Closed').length;
    return [
      { label: 'Total Irregularities', value: total || rows.length, color: 'var(--submission-accent)', attention: false },
      { label: 'High Priority Open', value: highPriority, color: 'var(--submission-danger)', attention: highPriority > 0 },
      { label: 'Under Investigation', value: investigating, color: 'var(--submission-info)', attention: false },
      { label: 'Closed', value: closed, color: 'var(--submission-success)', attention: false },
    ];
  });

  readonly coaStatCards = computed(() => {
    const counts = this.coaSummary()?.counts;
    const confirmed = (counts?.mappingsConfirmed ?? 0) + this.confirmedCoaRows().size;
    return [
      { label: 'Accounts Reviewed', value: counts?.accountsReviewed ?? 0, color: 'var(--submission-accent)', attention: false },
      { label: 'Mappings Confirmed', value: confirmed, color: 'var(--submission-success)', attention: false },
      { label: 'Low Confidence Pending', value: counts?.lowConfidencePending ?? 0, color: 'var(--submission-warning)', attention: false },
      { label: 'Unmapped Pending', value: counts?.unmappedPending ?? 0, color: 'var(--submission-danger)', attention: (counts?.unmappedPending ?? 0) > 0 },
    ];
  });

  readonly coaHasBlockers = computed(() => {
    const counts = this.coaSummary()?.counts;
    return (counts?.lowConfidencePending ?? 0) + (counts?.unmappedPending ?? 0) > 0;
  });

  readonly groupNodes = computed<CoaGroupNode[]>(() => this.coaSchema()?.groupNodes ?? []);

  constructor(
    private readonly submissionReviewService: SubmissionReviewService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadAffiliateLists();
  }

  private loadAffiliateLists(): void {
    this.affiliateLoading.set(true);
    this.error.set(null);

    this.submissionReviewService.getFinanceAffiliates().subscribe({
      next: (affiliates) => {
        this.financeAffiliates.set(affiliates);
        if (affiliates.length) {
          if (!this.completenessAffiliate()) {
            this.completenessAffiliate.set(affiliates[0].entityCode);
            this.loadCompleteness();
          }
          // Irregularities defaults to the same first affiliate but is not
          // fetched yet — it lazily loads the first time that tab is visited.
          if (!this.irregularitiesAffiliate()) {
            this.irregularitiesAffiliate.set(affiliates[0].entityCode);
          }
        }
      },
      error: (err) => this.handleError(err, 'Could not load affiliate list for Completeness and Irregularities Review.'),
    });

    this.submissionReviewService.getCoaAffiliates().subscribe({
      next: (affiliates) => {
        this.coaAffiliates.set(affiliates);
        const defaultAffiliate = affiliates.find((a) => a.isDefault)?.key ?? affiliates[0]?.key ?? '';
        if (!this.coaAffiliate() && defaultAffiliate) this.coaAffiliate.set(defaultAffiliate);
      },
      error: (err) => this.handleError(err, 'Could not load affiliate list for CoA Mapping Review.'),
      complete: () => this.affiliateLoading.set(false),
    });
  }

  selectAffiliate(value: string): void {
    this.error.set(null);

    if (this.tab() === 'coa') {
      this.coaAffiliate.set(value);
      this.coaPage.set(1);
      this.confirmedCoaRows.set(new Set());
      this.loadCoa();
      return;
    }

    if (this.tab() === 'irregularities') {
      this.irregularitiesAffiliate.set(value);
      this.findingStatusOverrides.set({});
      this.loadIrregularities(1);
      return;
    }

    // completeness
    this.uploads.set({});
    this.collapsedGroups.set({});
    this.completenessAffiliate.set(value);
    this.loadCompleteness();
  }

  onAffiliateSelectChange(value: string): void {
    this.selectAffiliate(value);
  }

  selectTab(tab: MainTab): void {
    this.tab.set(tab);
    this.error.set(null);

    // Only fetch if this tab has never loaded data for its own currently
    // selected affiliate. Switching affiliates elsewhere (selectAffiliate)
    // always fetches fresh data directly, independent of this cache.
    if (tab === 'completeness' && this.completenessAffiliate() && !this.completenessLoadedFor.has(this.completenessAffiliate())) {
      this.loadCompleteness();
    }
    if (tab === 'irregularities' && this.irregularitiesAffiliate() && !this.irregularitiesLoadedFor.has(this.irregularitiesAffiliate())) {
      this.loadIrregularities(this.irregularitiesPage());
    }
    if (tab === 'coa' && this.coaAffiliate() && !this.coaLoadedFor.has(this.coaAffiliate())) {
      this.loadCoa();
    }
  }

  goToTab(tab: MainTab): void {
    this.selectTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToCompliance(): void {
    this.router.navigate(['/ifrs']);
  }

  toggleGroup(group: string): void {
    this.collapsedGroups.update((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  isCollapsed(group: string): boolean {
    return Boolean(this.collapsedGroups()[group]);
  }

  onIrregularitiesPageChange(page: number): void {
    this.loadIrregularities(page);
  }

  onCoaPageChange(page: number): void {
    this.loadCoa(page);
  }

  private loadCompleteness(): void {
    if (!this.completenessAffiliate()) return;
    const affiliate = this.completenessAffiliate();
    this.completenessLoading.set(true);
    this.submissionReviewService.getChecklist(affiliate).subscribe({
      next: (checklist) => this.checklist.set(checklist),
      error: (err) => this.handleError(err, 'Could not load completeness review.'),
      complete: () => {
        this.completenessLoading.set(false);
        this.completenessLoadedFor.add(affiliate);
      },
    });
  }

  private loadIrregularities(page: number): void {
    if (!this.irregularitiesAffiliate()) return;
    const affiliate = this.irregularitiesAffiliate();
    this.irregularitiesPage.set(page);
    this.irregularitiesLoading.set(true);
    this.submissionReviewService.getFindings(affiliate, page).subscribe({
      next: (result) => {
        const overrides = this.findingStatusOverrides();
        this.findings.set(result.items.map((row) => ({
          ...row,
          status: overrides[`${affiliate}:${row.accountCode}`] ?? row.status,
        })));
        this.irregularitiesTotalPages.set(result.totalPages);
        this.irregularitiesTotalCount.set(result.totalCount);
      },
      error: (err) => this.handleError(err, 'Could not load irregularities review.'),
      complete: () => {
        this.irregularitiesLoading.set(false);
        this.irregularitiesLoadedFor.add(affiliate);
      },
    });
  }

  private loadCoa(page = this.coaPage()): void {
    if (!this.coaAffiliate()) return;
    const affiliate = this.coaAffiliate();
    this.coaPage.set(page);
    this.coaLoading.set(true);
    this.error.set(null);

    let schema$ = this.coaSchema();
    const schemaObservable = schema$ ? null : this.submissionReviewService.getCoaSchema();

    const finish = (schema: CoaSchema | null) => {
      if (schema) this.coaSchema.set(schema);
      this.submissionReviewService.getCoaSummary(affiliate).subscribe({
        next: (summary) => this.coaSummary.set(summary),
        error: (err) => this.handleError(err, 'Could not load CoA mapping summary.'),
      });
      this.submissionReviewService.getCoaRows(affiliate, page).subscribe({
        next: (result) => {
          // Default every row to "no pending change yet" regardless of what
          // the backend sends for pendingSelection/canConfirm, so Confirm
          // Mapping starts disabled until the user actually edits the
          // dropdown away from the current backend-provided mapping.
          this.coaRows.set(result.items.map((row) => ({
            ...row,
            pendingSelection: row.currentGroupNode ?? '',
            canConfirm: false,
          })));
          this.coaTotalPages.set(result.totalPages);
        },
        error: (err) => this.handleError(err, 'Could not load CoA mapping rows.'),
        complete: () => {
          this.coaLoading.set(false);
          this.coaLoadedFor.add(affiliate);
        },
      });
    };

    if (schemaObservable) {
      schemaObservable.subscribe({
        next: (schema) => finish(schema),
        error: (err) => {
          this.handleError(err, 'Could not load CoA mapping schema.');
          this.coaLoading.set(false);
        },
      });
    } else {
      finish(schema$);
    }
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
    if (status === 'High Confidence') return { color: 'var(--submission-success)', background: 'var(--submission-success-soft)', border: 'var(--submission-success-border)' };
    if (status === 'Low Confidence') return { color: 'var(--submission-warning)', background: 'var(--submission-warning-soft)', border: 'var(--submission-warning-border)' };
    return { color: 'var(--submission-danger)', background: 'var(--submission-danger-soft)', border: 'var(--submission-danger-border)' };
  }

  // Driven directly by the API's severityColor now ('red' | 'yellow')
  // instead of a client-derived 'High' | 'Medium' severity.
  flagClass(active: boolean, severityColor: 'red' | 'yellow'): string {
    if (!active) return '';
    return severityColor === 'red' ? 'flag-high' : 'flag-medium';
  }

  /* ---------- Finding status is intentionally client-side until PATCH exists ---------- */

  onFindingStatusChange(index: number, status: FindingStatus): void {
    const row = this.findings()[index];
    if (!row) return;
    const key = `${this.irregularitiesAffiliate()}:${row.accountCode}`;
    this.findingStatusOverrides.update((prev) => ({ ...prev, [key]: status }));
    this.findings.update((rows) => rows.map((r, i) => (i === index ? { ...r, status } : r)));
  }

  /* ---------- CoA mapping ---------- */

  groupNodeLabel(code: string | null): string {
    if (!code) return '';
    return this.groupNodes().find((node) => node.code === code)?.label ?? code;
  }

  onCoaMappingChange(index: number, value: string): void {
    const row = this.coaRows()[index];
    if (!row) return;
    const selectedNode = this.groupNodes().find((node) => node.code === value);
    this.coaRows.update((rows) => rows.map((r, i) => i === index
      ? {
          ...r,
          pendingSelection: value,
          selectedMapping: selectedNode?.name ?? value,
          canConfirm: !!value && value !== (r.currentGroupNode ?? ''),
        }
      : r));
  }

  confirmCoaMapping(index: number): void {
    const row = this.coaRows()[index];
    const groupNode = row?.pendingSelection;
    if (!row || !groupNode || groupNode === row.currentGroupNode) return;

    this.coaRows.update((rows) => rows.map((r, i) => i === index ? { ...r, canConfirm: false } : r));

    this.submissionReviewService.confirmCoaMapping(this.coaAffiliate(), row.rowId, groupNode).subscribe({
      next: (result) => {
        const returned = result.row;
        const confirmed = returned.mappingStatus === 'High Confidence';
        if (confirmed) {
          this.confirmedCoaRows.update((ids) => {
            const next = new Set(ids);
            next.add(returned.rowId);
            return next;
          });
        }

        this.coaRows.update((rows) => rows.map((r) => r.rowId === returned.rowId
          ? {
              ...r,
              currentGroupNode: returned.currentGroupNode,
              selectedMapping: returned.currentGroupMapping,
              mappingStatus: returned.mappingStatus,
              rationale: returned.rationale,
              canConfirm: false,
              confirmed,
              pendingSelection: returned.currentGroupNode,
            }
          : r));

        this.coaSummary.update((summary) => summary
          ? { ...summary, counts: result.counts }
          : summary);
      },
      error: (err) => this.handleError(err, 'Could not confirm the CoA mapping.'),
    });
  }

  /* ---------- Upload ---------- */

  uploadKey(group: string, itemLabel: string): string {
    return `${this.completenessAffiliate()}:${group}:${itemLabel}`;
  }

  uploadState(key: string): UploadState {
    return this.uploads()[key] ?? { phase: 'idle', progress: 0, filename: '' };
  }

  onFileSelected(event: Event, key: string, groupName: string, itemLabel: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.startUpload(key, groupName, itemLabel, file);
  }

  private startUpload(key: string, groupName: string, itemLabel: string, file: File): void {
    this.uploads.update((prev) => ({ ...prev, [key]: { phase: 'uploading', progress: 0, filename: file.name } }));
    this.submissionReviewService.uploadChecklistFile(this.completenessAffiliate(), itemLabel, file).subscribe({
      next: ({ progress, done }) => {
        this.uploads.update((prev) => ({
          ...prev,
          [key]: { phase: done ? 'done' : 'uploading', progress, filename: file.name },
        }));
        if (done) {
          this.loadCompleteness();
        }
      },
      error: (err) => {
        this.uploads.update((prev) => ({ ...prev, [key]: { phase: 'error', progress: 0, filename: file.name } }));
        this.handleError(err, `Could not upload ${file.name}.`);
      },
    });
  }

  private handleError(error: unknown, fallback: string): void {
    console.error(error);
    this.error.set(fallback);
  }
}