import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { delay } from 'rxjs/operators';
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
  IrregularitiesSummary,
  UploadState,
} from '../../core/models/submission-review.model';
import { ConfirmDialogComponent, ConfirmDialogSegment } from '../../shared/confirm-dialog/confirm-dialog.component';

type MainTab = 'completeness' | 'irregularities' | 'coa';

const TAB_LABEL: Record<MainTab, string> = {
  completeness: 'Completeness Review',
  irregularities: 'Irregularities Review',
  coa: 'CoA Mapping Review',
};

const PERIOD_LABEL = 'Q1 2026';

const TRIAL_BALANCE_NOT_READY_FALLBACK =
  'Irregularities review requires a complete Trial Balance submission for this period.';

interface IrregularitiesBlockedState {
  blocked: boolean;
  message: string;
}

const IRREGULARITIES_NOT_BLOCKED: IrregularitiesBlockedState = { blocked: false, message: '' };

/** NOTE ON THIS HEADER CONTACT/PENDING-ITEMS BLOCK
 * ---------------------------------------------------------
 * No backing endpoint exists yet for the affiliate's point-of-contact
 * details or a cross-tab "total pending items" count, so both are
 * mock data (deterministically seeded from the affiliate name, so the
 * same affiliate always shows the same mock contact rather than a
 * random one on every load). Wrapped in a simulated delay so the header
 * skeleton has something real to demonstrate; wire a real endpoint into
 * `loadHeaderInfo()` when one exists -- nothing else in the component
 * needs to change. */
interface AffiliateContactInfo {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
}

function mockContactFor(affiliateName: string): AffiliateContactInfo {
  const slug = affiliateName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return {
    name: `${affiliateName} Representative`,
    role: 'Finance Submission Point of Contact',
    company: affiliateName,
    email: `xxx.xxx@${slug || 'affiliate'}.com`,
    phone: '+966 5X XXX XXXX',
  };
}

function mockPendingCountFor(affiliateName: string): number {
  const sum = affiliateName.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return 4 + (sum % 12); // representative range, deterministic per affiliate
}

/** Shape of the API's error envelope body, e.g.:
 *  { success: false, data: null, message: "...", errors: [{ code, field, message }] } */
interface ApiErrorBody {
  success: boolean;
  message?: string;
  errors?: { code: string; field?: string | null; message: string }[];
}

function getApiErrorCode(err: unknown): string | null {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiErrorBody | undefined;
    return body?.errors?.[0]?.code ?? null;
  }
  return null;
}

// The user-facing text lives on the envelope's top-level "message" field
// (not errors[0].message, which tends to hold internal/diagnostic detail).
function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiErrorBody | undefined;
    if (body?.message) return body.message;
  }
  return fallback;
}

@Component({
  selector: 'app-submission-review',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, SkeletonComponent, PaginationComponent,  ConfirmDialogComponent],
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
  readonly irregularitiesSummary = signal<IrregularitiesSummary | null>(null);
  readonly coaRows = signal<CoaRow[]>([]);
  readonly coaSchema = signal<CoaSchema | null>(null);
  readonly coaSummary = signal<CoaSummary | null>(null);

  readonly pendingCoaConfirmation = signal<{
  index: number;
  accountCode: string;
  description: string;
  targetLabel: string;
} | null>(null);

readonly coaConfirmInFlight = signal(false);

readonly pendingCoaConfirmationSegments = computed<ConfirmDialogSegment[]>(() => {
  const p = this.pendingCoaConfirmation();
  if (!p) return [];
  return [
    { text: 'Confirm mapping account ' },
    { text: p.accountCode, emphasis: true },
    { text: ` — ${p.description} to "` },
    { text: p.targetLabel, emphasis: true },
    { text: '". This will mark the mapping as resolved.' },
  ];
});

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
  // Set when the API returns TRIAL_BALANCE_NOT_READY for the selected
  // affiliate — replaces the KPI cards + table with a disabled-state message.
  readonly irregularitiesBlocked = signal<IrregularitiesBlockedState>(IRREGULARITIES_NOT_BLOCKED);
  readonly coaPage = signal(1);
  readonly coaTotalPages = signal(1);

  readonly collapsedGroups = signal<Record<string, boolean>>({});
  readonly uploads = signal<Record<string, UploadState>>({});
  readonly findingStatusOverrides = signal<Record<string, FindingStatus>>({});

  // -----------------------------------------------------------------------
  // Tab load cache: tracks which affiliate's data has already been fetched
  // for each tab, so revisiting a tab (without changing affiliate) does not
  // refetch. Keyed by affiliate identifier (entityCode / coa key).
  // -----------------------------------------------------------------------
  private readonly completenessLoadedFor = new Set<string>();
  private readonly irregularitiesLoadedFor = new Set<string>();
  private readonly coaLoadedFor = new Set<string>();

  readonly reviewerName = computed(() => this.authService.currentUser()?.name ?? 'Aniket Sonkar');

  /** Display name carried over via router state from the Affiliate Landing
   * page (e.g. "SABIC"), so the header shows exactly the name the person
   * clicked rather than whatever entityName the affiliate API happens to
   * return for that code (which may be a longer/legal name). Falls back to
   * the API-provided name for direct/standalone visits with no state. */
  private readonly passedAffiliateName = (history.state as { affiliateName?: string } | undefined)?.affiliateName ?? null;

  readonly activeAffiliateName = computed(() => {
    if (this.passedAffiliateName) return this.passedAffiliateName;
    if (this.tab() === 'coa') {
      return this.coaAffiliates().find((a) => a.key === this.coaAffiliate())?.name ?? this.coaAffiliate();
    }
    const code = this.tab() === 'irregularities' ? this.irregularitiesAffiliate() : this.completenessAffiliate();
    return this.financeAffiliates().find((a) => a.entityCode === code)?.entityName ?? code;
  });

  // ---- Header point-of-contact + pending-items badge (mock; see note above) ----
  readonly headerLoading = signal(true);
  readonly headerContact = signal<AffiliateContactInfo | null>(null);
  readonly headerPendingCount = signal<number | null>(null);
  private lastHeaderAffiliate: string | null = null;

  private readonly headerInfoEffect = effect(() => {
    // Driven off the Completeness affiliate specifically -- it's the one
    // set as soon as the page loads (from the landing page or the default
    // "first affiliate"), so the header identity is stable and doesn't
    // flicker as the person switches tabs. Prefers the name carried over
    // from the landing page (see passedAffiliateName) so the contact card's
    // "{name} Representative" matches the header title exactly.
    const code = this.completenessAffiliate();
    const name = this.passedAffiliateName ?? this.financeAffiliates().find((a) => a.entityCode === code)?.entityName;
    if (!name || name === this.lastHeaderAffiliate) return;
    this.lastHeaderAffiliate = name;
    this.loadHeaderInfo(name);
  });

  private loadHeaderInfo(affiliateName: string): void {
    this.headerLoading.set(true);
    of(null).pipe(delay(500)).subscribe(() => {
      this.headerContact.set(mockContactFor(affiliateName));
      this.headerPendingCount.set(mockPendingCountFor(affiliateName));
      this.headerLoading.set(false);
    });
  }

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
    // "Required items" excludes Not Applicable -- those items simply aren't
    // required, so they don't count toward the completeness percentage.
    const requiredTotal = counts.Complete + counts.Incomplete + counts.Missing;
    const completePct = requiredTotal > 0 ? Math.round((counts.Complete / requiredTotal) * 100) : 0;
    return [
      {
        label: 'Affiliate Submission Complete',
        value: counts.Complete,
        color: 'var(--submission-success)',
        detail: `${completePct}% of required items`,
        attention: false,
      },
      {
        label: 'Affiliate Submission Missing',
        value: counts.Missing,
        color: 'var(--submission-danger)',
        detail: 'Required items not submitted',
        attention: false,
      },
      {
        label: 'Affiliate Submission Partial',
        value: counts.Incomplete,
        color: 'var(--submission-warning)',
        detail: 'Submitted but incomplete',
        attention: false,
      },
    ];
  });

  getGroupNodeLabel(groupNodeCode: string | null): string {
    if (!groupNodeCode) {
      return '—';
    }

    const node = this.groupNodes().find((item) => item.code === groupNodeCode);
    return node?.label ?? groupNodeCode;
  }

  mappingLabel(row: any): string {
    return this.groupNodes().find(n => n.code === row.pendingSelection)?.label ?? row.pendingSelection ?? '—';
  }

  readonly irregularitiesTotal = computed(() => this.irregularitiesSummary()?.total ?? 0);

  /** Purely presentational: the "X resolved · Y requiring review" detail
   * line under the Total Irregularities card. Reuses the same summary data
   * already fetched for irregularitiesStatusBreakdown -- no new fetch/logic. */
  readonly irregularitiesResolvedCount = computed(() => this.irregularitiesSummary()?.closed ?? 0);
  readonly irregularitiesRequiringReview = computed(() => this.irregularitiesTotal() - this.irregularitiesResolvedCount());

  readonly irregularitiesPriorityBreakdown = computed(() => {
    const s = this.irregularitiesSummary();
    return [
      { label: 'High', value: s?.highSeverity ?? 0, color: 'var(--submission-danger)' },
      { label: 'Medium', value: s?.midSeverity ?? 0, color: 'var(--submission-warning)' },
      { label: 'Low', value: s?.lowSeverity ?? 0, color: 'var(--submission-info)' },
    ];
  })

  readonly irregularitiesStatusBreakdown = computed(() => {
    const s = this.irregularitiesSummary();
    return [
      { label: 'Open', value: s?.open ?? 0, color: 'var(--submission-warning)' },
      { label: 'Investigate', value: s?.underInvestigation ?? 0, color: 'var(--submission-info)' },
      { label: 'Closed', value: s?.closed ?? 0, color: 'var(--submission-success)' },
    ];
  });

  // readonly irregularitiesStatCards = computed(() => {
  //   const summary = this.irregularitiesSummary();
  //   const total = summary?.totalIrregularities ?? 0;
  //   const highPriority = summary?.highPriorityOpen ?? 0;
  //   const investigating = summary?.underInvestigation ?? 0;
  //   const closed = summary?.closed ?? 0;
  //   return [
  //     { label: 'Total Irregularities', value: total, color: 'var(--submission-accent)', attention: false },
  //     { label: 'High Priority Open', value: highPriority, color: 'var(--submission-danger)', attention: highPriority > 0 },
  //     { label: 'Under Investigation', value: investigating, color: 'var(--submission-info)', attention: false },
  //     { label: 'Closed', value: closed, color: 'var(--submission-success)', attention: false },
  //   ];
  // });


  readonly coaOverviewCard = computed(() => {
    const counts = this.coaSummary()?.counts;
    const total = counts?.accountsReviewed ?? 0;
    const high = counts?.highConfidence ?? 0;
    const low = counts?.lowConfidencePending ?? 0;
    const unmapped = counts?.unmappedPending ?? 0;

    return {
      total,
      breakdown: [
        { label: 'High Confidence', value: high, color: 'var(--submission-success)' },
        { label: 'Low Confidence', value: low, color: 'var(--submission-warning)' },
        { label: 'Unmapped', value: unmapped, color: 'var(--submission-danger)' },
      ],
    };
  });

  readonly coaTableColumns = computed(() => this.coaSchema()?.tableColumns ?? []);
  readonly coaUnits = computed(() => this.coaSchema()?.units ?? this.coaSummary()?.session.units ?? '');
  readonly coaPeriod = computed(() => this.coaSchema()?.period ?? this.coaSummary()?.session.periodLabel ?? PERIOD_LABEL);

  private coaConfidenceVocabulary = computed(() => this.coaSchema()?.mappingConfidences ?? []);
  private coaReviewStatusVocabulary = computed(() => this.coaSchema()?.reviewStatuses ?? []);

  readonly coaHasBlockers = computed(() => {
    // The completion banner is driven by review status, not confidence.
    // lowConfidencePending remains the model's original classification and
    // does not decrease when a reviewer resolves a row.
    return (this.coaSummary()?.counts?.pending ?? 0) > 0;
  });

  readonly groupNodes = computed<CoaGroupNode[]>(() => this.coaSchema()?.groupNodes ?? []);

  /** Entity code carried over from the new Affiliate Landing page (Step 1 of
   *  the submission flow: /submission → pick an affiliate → /submission/review/:entityCode).
   *  Direct visits to /submission/review with no param fall back to the
   *  previous "first affiliate in the list" default, so this page still
   *  works standalone. */
  private preselectedEntityCode: string | null = null;

  constructor(
    private readonly submissionReviewService: SubmissionReviewService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.preselectedEntityCode = this.route.snapshot.paramMap.get('entityCode');

    // Schema is configuration for the CoA table, so fetch it once when the
    // screen starts rather than coupling it to a particular affiliate.
    this.loadCoaSchema();
    this.loadAffiliateLists();
  }

  /** True when this page was reached via the Affiliate Landing page for a
   *  specific affiliate (rather than a direct/standalone visit). Used to
   *  show a small "change affiliate" breadcrumb back to the landing page. */
  get cameFromLanding(): boolean {
    return !!this.preselectedEntityCode;
  }

  backToLanding(): void {
    this.router.navigate(['/submission']);
  }

  private loadCoaSchema(): void {
    this.submissionReviewService.getCoaSchema().subscribe({
      next: (schema) => this.coaSchema.set(schema),
      error: (err) => this.handleError(err, 'Could not load CoA mapping schema.'),
    });
  }

  private loadAffiliateLists(): void {
    this.affiliateLoading.set(true);
    this.error.set(null);

    this.submissionReviewService.getFinanceAffiliates().subscribe({
      next: (affiliates) => {
        this.financeAffiliates.set(affiliates);
        if (affiliates.length) {
          // Prefer the affiliate carried over from the landing page, when it
          // still exists in the fetched list; otherwise fall back to the
          // first affiliate exactly as before.
          const preferredCode =
            (this.preselectedEntityCode && affiliates.some((a) => a.entityCode === this.preselectedEntityCode)
              ? this.preselectedEntityCode
              : affiliates[0].entityCode);

          if (!this.completenessAffiliate() || this.preselectedEntityCode) {
            this.completenessAffiliate.set(preferredCode);
            this.loadCompleteness();
          }
          // Irregularities defaults to the same affiliate but is not
          // fetched yet — it lazily loads the first time that tab is visited.
          if (!this.irregularitiesAffiliate() || this.preselectedEntityCode) {
            this.irregularitiesAffiliate.set(preferredCode);
          }
        }
      },
      error: (err) => this.handleError(err, 'Could not load affiliate list for Completeness and Irregularities Review.'),
    });

    this.submissionReviewService.getCoaAffiliates().subscribe({
      next: (affiliates) => {
        this.coaAffiliates.set(affiliates);
        const preferredKey = this.preselectedEntityCode && affiliates.some((a) => a.key === this.preselectedEntityCode)
          ? this.preselectedEntityCode
          : null;
        const defaultAffiliate = preferredKey ?? affiliates.find((a) => a.isDefault)?.key ?? affiliates[0]?.key ?? '';
        if ((!this.coaAffiliate() || preferredKey) && defaultAffiliate) this.coaAffiliate.set(defaultAffiliate);
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

  /** "Expand All" button in the tabs row. Purely a convenience wrapper
   * around the existing per-group collapse state -- toggles every group at
   * once rather than introducing any new expand/collapse behaviour. */
  readonly allGroupsExpanded = computed(() => this.checklist().every((g) => !this.isCollapsed(g.group)));

  toggleExpandAll(): void {
    const expand = !this.allGroupsExpanded();
    const next: Record<string, boolean> = {};
    this.checklist().forEach((g) => (next[g.group] = !expand));
    this.collapsedGroups.set(next);
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
      next: (checklist) => {
        this.checklist.set(checklist);
        // Default every group to collapsed on load, matching the approved
        // design. Doesn't touch collapse/expand behaviour itself -- just
        // the starting state.
        const collapsed: Record<string, boolean> = {};
        checklist.forEach((g) => (collapsed[g.group] = true));
        this.collapsedGroups.set(collapsed);
      },
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
    this.irregularitiesBlocked.set(IRREGULARITIES_NOT_BLOCKED);

    // Findings (table rows) and the summary card counts come from two
    // separate endpoints — the summary is authoritative for the KPI cards
    // regardless of which page of findings is currently on screen.
    forkJoin({
      findings: this.submissionReviewService.getFindings(affiliate, page),
      summary: this.submissionReviewService.getIrregularitiesSummary(affiliate),
    }).subscribe({
      next: ({ findings, summary }) => {
        const overrides = this.findingStatusOverrides();
        this.findings.set(findings.items.map((row, i) => this.mockExpandFinding({
          ...row,
          status: overrides[`${affiliate}:${row.accountCode}`] ?? row.status,
        }, i)));
        this.irregularitiesTotalPages.set(findings.totalPages);
        this.irregularitiesTotalCount.set(findings.totalCount);
        this.irregularitiesSummary.set(summary);
        this.irregularitiesLoading.set(false);
        this.irregularitiesLoadedFor.add(affiliate);
      },
      error: (err) => {
        // forkJoin never fires `complete` after `error`, so loading/cache
        // state has to be settled here too — otherwise the skeleton would
        // stay on screen for any irregularities error, not just this one.
        this.irregularitiesLoading.set(false);
        this.irregularitiesLoadedFor.add(affiliate);

        if (getApiErrorCode(err) === 'TRIAL_BALANCE_NOT_READY') {
          this.irregularitiesBlocked.set({
            blocked: true,
            message: getApiErrorMessage(err, TRIAL_BALANCE_NOT_READY_FALLBACK),
          });
          return;
        }

        this.handleError(err, 'Could not load irregularities review.');
      },
    });
  }

  private loadCoa(page = this.coaPage()): void {
    if (!this.coaAffiliate()) return;
    const affiliate = this.coaAffiliate();
    this.coaPage.set(page);
    this.coaLoading.set(true);
    this.error.set(null);

    this.submissionReviewService.getCoaSummary(affiliate).subscribe({
      next: (summary) => this.coaSummary.set(summary),
      error: (err) => this.handleError(err, 'Could not load CoA mapping summary.'),
    });

    this.submissionReviewService.getCoaRows(affiliate, page).subscribe({
      next: (result) => {
        // Keep the server ordering. The API already returns rows ordered by
        // QTD magnitude and pagination preserves that order.
        this.coaRows.set(result.items.map((row) => ({
          ...row,
          // canConfirm is authoritative from /mappings. In particular,
          // High/Low confidence rows can be confirmed; Unmapped stays disabled
          // until a Group node is selected.
          pendingSelection: row.currentGroupNode,
          canConfirm: row.canConfirm,
        })));
        this.coaTotalPages.set(result.totalPages);
      },
      error: (err) => this.handleError(err, 'Could not load CoA mapping rows.'),
      complete: () => {
        this.coaLoading.set(false);
        this.coaLoadedFor.add(affiliate);
      },
    });
  }

  coaColumnClass(key: string): string {
    const classes: Record<string, string> = {
      affiliateAccount: 'coa-account',
      description: 'coa-description',
      monthValue: 'coa-month',
      qtdValue: 'coa-qtd',
      ytdValue: 'coa-ytd',
      currentGroupMapping: 'coa-mapping',
      mappingConfidence: 'coa-confidence',
      status: 'coa-status',
      rationale: 'coa-rationale',
      canConfirm: 'coa-action',
    };
    return classes[key] ?? '';
  }

  coaColumnLabel(column: { key: string; label: string; type: string }): string {
    if (column.type === 'amount' && this.coaUnits()) {
      return `${column.label} (${this.coaUnits()})`;
    }
    return column.label;
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

  private toneStyle(tone: 'success' | 'warning' | 'danger' | 'info') {
    if (tone === 'success') return { color: 'var(--submission-success)', background: 'var(--submission-success-soft)', border: 'var(--submission-success-border)' };
    if (tone === 'warning') return { color: 'var(--submission-warning)', background: 'var(--submission-warning-soft)', border: 'var(--submission-warning-border)' };
    if (tone === 'info') return { color: 'var(--submission-info)', background: 'var(--submission-info-soft)', border: 'var(--submission-info-border)' };
    return { color: 'var(--submission-danger)', background: 'var(--submission-danger-soft)', border: 'var(--submission-danger-border)' };
  }

  mappingConfidenceStyle(status: string) {
    const vocabulary = this.coaConfidenceVocabulary().find((item) => item.value === status);
    return this.toneStyle(vocabulary?.tone ?? 'danger');
  }

  reviewStatusStyle(status: string) {
    const vocabulary = this.coaReviewStatusVocabulary().find((item) => item.value === status);
    return this.toneStyle(vocabulary?.tone ?? 'warning');
  }

  // Driven directly by the API's severityColor now ('red' | 'yellow')
  // instead of a client-derived 'High' | 'Medium' severity.
  flagClass(active: boolean, severityColor: 'red' | 'yellow'): string {
    if (!active) return '';
    return severityColor === 'red' ? 'flag-high' : 'flag-medium';
  }

  // TEMP: Priority + the new QTD/YTD comparison fields aren't in the API yet.
  // `??` only fills what's missing, so this quietly becomes a no-op (and can
  // be deleted) once the backend adds real values — no other code changes.
  private readonly MOCK_PRIORITIES: Array<'High' | 'Medium' | 'Low'> = ['High', 'Medium', 'Low'];

  private mockExpandFinding(row: Finding, index: number): Finding {
    return {
      ...row,
      qtd: row.qtd ?? row.currentPeriod,
      priorYearQtd: row.priorYearQtd ?? row.priorPeriod,
      qoqDelta: row.qoqDelta ?? row.change,
      ytd: row.ytd ?? row.currentPeriod,
      priorYearYtd: row.priorYearYtd ?? row.priorPeriod,
      yoyDelta: row.yoyDelta ?? row.change,
      priority: row.priority ?? this.MOCK_PRIORITIES[index % this.MOCK_PRIORITIES.length],
    };
  }

  priorityStyle(priority: string | undefined) {
    if (priority === 'High') return this.toneStyle('danger');
    if (priority === 'Medium') return this.toneStyle('warning');
    return this.toneStyle('info');
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

  confirmCoaMapping(index: number, onSettled?: () => void): void {
    const row = this.coaRows()[index];
    const groupNode = row?.pendingSelection;
    if (!row || !groupNode) {
      onSettled?.();
      return;
    }

    this.coaRows.update((rows) => rows.map((r, i) => i === index ? { ...r, canConfirm: false } : r));

    this.submissionReviewService.confirmCoaMapping(this.coaAffiliate(), row.rowId, groupNode).subscribe({
      next: (result) => {
        const returned = result.row;
        const confirmed = returned.status === 'Confirmed';
        this.coaRows.update((rows) => rows.map((r) => r.rowId === returned.rowId
          ? {
              ...r,
              currentGroupNode: returned.currentGroupNode,
              selectedMapping: returned.currentGroupMapping,
              mappingConfidence: returned.mappingConfidence,
              status: returned.status,
              monthValue: returned.monthValue,
              qtdValue: returned.qtdValue,
              ytdValue: returned.ytdValue,
              rationale: returned.rationale,
              canConfirm: returned.canConfirm,
              confirmed,
              pendingSelection: returned.currentGroupNode,
            }
          : r));

        if (result.counts) {
          this.coaSummary.update((summary) => summary
            ? { ...summary, counts: result.counts! }
            : summary);
        } else {
          this.submissionReviewService.getCoaSummary(this.coaAffiliate()).subscribe({
            next: (summary) => this.coaSummary.set(summary),
            error: (err) => this.handleError(err, 'Could not refresh CoA mapping summary.'),
          });
        }
        onSettled?.();
      },
      error: (err) => {
        this.handleError(err, 'Could not confirm the CoA mapping.');
        onSettled?.();
      },
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

  requestConfirmCoaMapping(index: number): void {
  const row = this.coaRows()[index];
  if (!row || !row.canConfirm || !row.pendingSelection) return;

  this.pendingCoaConfirmation.set({
      index,
      accountCode: row.code,
      description: row.description,
      targetLabel: this.mappingLabel(row),
    });
  }

cancelCoaConfirmation(): void {
  if (this.coaConfirmInFlight()) return;
  this.pendingCoaConfirmation.set(null);
}

confirmCoaMappingFromDialog(): void {
  const pending = this.pendingCoaConfirmation();
  if (!pending || this.coaConfirmInFlight()) return;

  this.coaConfirmInFlight.set(true);
    this.confirmCoaMapping(pending.index, () => {
      this.coaConfirmInFlight.set(false);
      this.pendingCoaConfirmation.set(null);
    });
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