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
import { ConfirmDialogComponent, ConfirmDialogSegment } from '../../shared/confirm-dialog/confirm-dialog.component';
import { PeriodToggleComponent, PeriodToggleOption } from '../../shared/period-toggle/period-toggle.component';
import { AuthService } from '../../core/services/auth.service';
import { SubmissionReviewService } from '../../core/services/submission-review.service';
import {
  ChecklistGroup,
  ChecklistStatus,
  CoaGroupNode,
  CoaRow,
  CoaSchema,
  CoaSummary,
  Finding,
  FindingStatus,
  IrregularitiesSummary,
  UploadState,
} from '../../core/models/submission-review.model';
import { AgentStatusCueComponent } from '../../shared/agent-status-cue/agent-status-cue.component';
import { SpecialistAgentComponent } from '../../shared/specialist-agent/specialist-agent.component';

type MainTab = 'completeness' | 'irregularities' | 'coa';
type PeriodView = 'monthly' | 'quarterly' | 'yearly';

const TAB_LABEL: Record<MainTab, string> = {
  completeness: 'Completeness Review',
  irregularities: 'Irregularities Review',
  coa: 'CoA Mapping Review',
};

const PERIOD_LABEL = 'Q1 2026';

const TRIAL_BALANCE_NOT_READY_FALLBACK =
  'Irregularities review requires a complete Trial Balance submission for this period.';

const PERIOD_TOGGLE_OPTIONS: PeriodToggleOption[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

interface IrregularitiesBlockedState {
  blocked: boolean;
  message: string;
}

const IRREGULARITIES_NOT_BLOCKED: IrregularitiesBlockedState = { blocked: false, message: '' };

/** NOTE ON THIS HEADER CONTACT/PENDING-ITEMS BLOCK
 * ---------------------------------------------------------
 * No backing endpoint exists yet for the affiliate's point-of-contact
 * details, so it's mock data (deterministically seeded from the affiliate
 * name, so the same affiliate always shows the same mock contact rather
 * than a random one on every load). Wrapped in a simulated delay so the
 * header skeleton has something real to demonstrate; wire a real endpoint
 * into `loadHeaderInfo()` when one exists -- nothing else needs to change. */
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
  return 4 + (sum % 12);
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
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    SkeletonComponent,
    PaginationComponent,
    ConfirmDialogComponent,
    PeriodToggleComponent,
    AgentStatusCueComponent,
    SpecialistAgentComponent,
  ],
  templateUrl: './submission-review.component.html',
  styleUrl: './submission-review.component.scss',
})
export class SubmissionReviewComponent implements OnInit {
  readonly tabLabel = TAB_LABEL;
  readonly tabs: MainTab[] = ['completeness', 'irregularities', 'coa'];
  readonly periodLabel = PERIOD_LABEL;
  readonly displayPeriod = computed(() => this.tab() === 'coa' ? (this.coaSummary()?.session.periodLabel ?? PERIOD_LABEL) : PERIOD_LABEL);

  readonly periodToggleOptions = PERIOD_TOGGLE_OPTIONS;

  readonly tabToggleOptions = computed<PeriodToggleOption[]>(() =>
    this.tabs.map((t) => ({ value: t, label: this.tabLabel[t] })),
  );

  readonly agentBriefing =
    'I am monitoring affiliate submission readiness, managing missing-input follow-ups, tracking affiliate responses and rerunning the affected checks as new files arrive. Routine affiliate interaction stays autonomous; I will only involve Finance when an exception requires judgment.';

  readonly agentSuggestions = ['Show current follow-up status', 'What happens next?'];

  // Every tab now shares one entity code -- the affiliate is chosen once on
  // the Landing page and carried in via the route param. There is no
  // affiliate list/dropdown on this screen anymore.
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

  readonly completenessLoading = signal(true);
  readonly irregularitiesLoading = signal(true);
  readonly coaLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly irregularitiesPage = signal(1);
  readonly irregularitiesTotalPages = signal(1);
  readonly irregularitiesTotalCount = signal(0);
  readonly irregularitiesBlocked = signal<IrregularitiesBlockedState>(IRREGULARITIES_NOT_BLOCKED);
  readonly coaPage = signal(1);
  readonly coaTotalPages = signal(1);

  readonly pendingStatusChange = signal<{ index: number; row: Finding; newStatus: FindingStatus } | null>(null);
  readonly statusChangeInFlight = signal(false);

  readonly pendingStatusChangeSegments = computed<ConfirmDialogSegment[]>(() => {
    const p = this.pendingStatusChange();
    if (!p) return [];
    return [
      { text: 'Change status of ' },
      { text: p.row.accountCode, emphasis: true },
      { text: ` — ${p.row.account} from ` },
      { text: p.row.status, emphasis: true },
      { text: ' to ' },
      { text: p.newStatus, emphasis: true },
      { text: '?' },
    ];
  });

  requestFindingStatusChange(index: number, status: FindingStatus): void {
    const row = this.findings()[index];
    // Since the <select> is bound one-way via [ngModel], not updating the
    // row here means Angular will reset the dropdown back to the current
    // status on the next change detection cycle if the person cancels.
    if (!row || row.status === status) return;
    this.pendingStatusChange.set({ index, row, newStatus: status });
  }

  cancelFindingStatusChange(): void {
    if (this.statusChangeInFlight()) return;
    this.pendingStatusChange.set(null);
  }

  confirmFindingStatusChange(): void {
    const pending = this.pendingStatusChange();
    if (!pending || this.statusChangeInFlight()) return;

    const { index, row, newStatus } = pending;
    this.statusChangeInFlight.set(true);

    this.submissionReviewService
      .updateFindingStatus(this.irregularitiesAffiliate(), row.accountCode, newStatus)
      .subscribe({
        next: () => {
          const key = `${this.irregularitiesAffiliate()}:${row.accountCode}`;
          this.findingStatusOverrides.update((prev) => ({ ...prev, [key]: newStatus }));
          this.findings.update((rows) => rows.map((r, i) => (i === index ? { ...r, status: newStatus } : r)));
          this.statusChangeInFlight.set(false);
          this.pendingStatusChange.set(null);
        },
        error: (err) => {
          this.handleError(err, 'Could not update the finding status.');
          this.statusChangeInFlight.set(false);
          this.pendingStatusChange.set(null);
        },
      });
  }

  // Monthly / Quarterly / Yearly toggle for each table. Purely a display
  // remap over data already fetched -- switching never triggers a refetch.
  readonly irregularitiesPeriodView = signal<PeriodView>('monthly');
  readonly coaPeriodView = signal<PeriodView>('monthly');

  readonly irregularitiesColumnLabels = computed(() => {
    const view = this.irregularitiesPeriodView();
    if (view === 'monthly') return { value: 'MTD', prior: 'Prior Year MTD', delta: 'MTD Delta' };
    if (view === 'quarterly') return { value: 'QTD', prior: 'Prior Year QTD', delta: 'QTD Delta' };
    return { value: 'YTD', prior: 'Prior Year YTD', delta: 'YTD Delta' };
  });

  readonly coaPeriodColumnBaseLabel = computed(() => {
    const view = this.coaPeriodView();
    return view === 'monthly' ? 'MTD' : view === 'quarterly' ? 'QTD' : 'YTD';
  });

  readonly collapsedGroups = signal<Record<string, boolean>>({});
  readonly uploads = signal<Record<string, UploadState>>({});
  readonly findingStatusOverrides = signal<Record<string, FindingStatus>>({});

  private readonly completenessLoadedFor = new Set<string>();
  private readonly irregularitiesLoadedFor = new Set<string>();
  private readonly coaLoadedFor = new Set<string>();

  readonly reviewerName = computed(() => this.authService.currentUser()?.name ?? 'Aniket Sonkar');

  /** Display name carried over via router state from the Affiliate Landing
   * page (e.g. "SABIC"), so the header shows exactly the name the person
   * clicked. There is no affiliate-list endpoint to fall back on anymore --
   * on a hard refresh (which loses router state), the header falls back to
   * showing the raw entity code until the person navigates back through
   * Landing again. */
  private readonly passedAffiliateName = (history.state as { affiliateName?: string } | undefined)?.affiliateName ?? null;

  readonly activeAffiliateName = computed(() => {
    if (this.passedAffiliateName) return this.passedAffiliateName;
    if (this.tab() === 'coa') return this.coaAffiliate();
    return this.tab() === 'irregularities' ? this.irregularitiesAffiliate() : this.completenessAffiliate();
  });

  // ---- Header point-of-contact + pending-items badge (mock; see note above) ----
  readonly headerLoading = signal(true);
  readonly headerContact = signal<AffiliateContactInfo | null>(null);
  readonly headerPendingCount = signal<number | null>(null);
  private lastHeaderAffiliate: string | null = null;

  private readonly headerInfoEffect = effect(() => {
    const code = this.completenessAffiliate();
    const name = this.passedAffiliateName ?? code;
    if (!name || name === this.lastHeaderAffiliate) return;
    this.lastHeaderAffiliate = name;
    this.loadHeaderInfo(name);
  });

  private loadHeaderInfo(affiliateName: string): void {
    this.headerLoading.set(true);
    of(null).pipe(delay(500)).subscribe(() => {
      this.headerContact.set(mockContactFor(affiliateName));
      this.headerLoading.set(false);
    });

    // Pending Items badge uses the real CoA summary's `counts.pending`,
    // independent of whether the CoA tab has been opened yet -- the header
    // is visible on every tab, so this needs its own fetch rather than
    // waiting on loadCoa().
    this.submissionReviewService.getCoaSummary(this.coaAffiliate()).subscribe({
      next: (summary) => this.headerPendingCount.set(summary.counts.pending),
      error: (err) => {
        console.error(err);
        // Leave headerPendingCount as-is (null) rather than showing a wrong number.
      },
    });
  }

  onTabToggleChange(value: string): void {
    this.selectTab(value as MainTab);
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
    if (!groupNodeCode) return '—';
    const node = this.groupNodes().find((item) => item.code === groupNodeCode);
    return node?.label ?? groupNodeCode;
  }

  mappingLabel(row: any): string {
    return this.groupNodes().find(n => n.code === row.pendingSelection)?.label ?? row.pendingSelection ?? '—';
  }

  readonly irregularitiesTotal = computed(() => this.irregularitiesSummary()?.total ?? 0);
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

  private readonly PERIOD_VALUE_KEYS = new Set(['monthValue', 'qtdValue', 'ytdValue']);

  readonly coaTableColumns = computed(() => this.coaSchema()?.tableColumns ?? []);

  /** Collapses the schema's separate monthValue/qtdValue/ytdValue columns
   *  into a single "periodValue" column whose label and cell content swap
   *  based on the Monthly/Quarterly/Yearly toggle -- the same mechanism
   *  used on the Irregularities table. If the schema doesn't define those
   *  three keys (e.g. an older schema), the columns pass through untouched. */
  readonly displayCoaColumns = computed(() => {
    const columns = this.coaTableColumns();
    const firstPeriodIndex = columns.findIndex((c) => this.PERIOD_VALUE_KEYS.has(c.key));
    if (firstPeriodIndex === -1) return columns;

    const survivors = columns.filter((c) => !this.PERIOD_VALUE_KEYS.has(c.key));
    const insertAt = columns.slice(0, firstPeriodIndex).filter((c) => !this.PERIOD_VALUE_KEYS.has(c.key)).length;

    const periodColumn = {
      ...columns[firstPeriodIndex],
      key: 'periodValue',
      label: this.coaPeriodColumnBaseLabel(),
    };

    survivors.splice(insertAt, 0, periodColumn);
    return survivors;
  });

  coaPeriodValue(row: CoaRow): string {
    const view = this.coaPeriodView();
    if (view === 'monthly') return row.monthValue;
    if (view === 'quarterly') return row.qtdValue;
    return row.ytdValue;
  }

  onCoaPeriodViewChange(view: string): void {
    this.coaPeriodView.set(view as PeriodView);
  }

  readonly coaUnits = computed(() => this.coaSchema()?.units ?? this.coaSummary()?.session.units ?? '');
  readonly coaPeriod = computed(() => this.coaSchema()?.period ?? this.coaSummary()?.session.periodLabel ?? PERIOD_LABEL);

  private coaConfidenceVocabulary = computed(() => this.coaSchema()?.mappingConfidences ?? []);
  private coaReviewStatusVocabulary = computed(() => this.coaSchema()?.reviewStatuses ?? []);

  readonly coaHasBlockers = computed(() => (this.coaSummary()?.counts?.pending ?? 0) > 0);

  readonly groupNodes = computed<CoaGroupNode[]>(() => this.coaSchema()?.groupNodes ?? []);

  /** Entity code carried over from the Affiliate Landing page
   *  (/submission → pick an affiliate → /submission/review/:entityCode).
   *  This screen has no affiliate list of its own anymore -- a direct visit
   *  with no entityCode redirects back to Landing rather than falling back
   *  to any "first affiliate" default. */
  private entityCode: string | null = null;

  constructor(
    private readonly submissionReviewService: SubmissionReviewService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const entityCode = this.route.snapshot.paramMap.get('entityCode');
    if (!entityCode) {
      this.router.navigate(['/submission']);
      return;
    }

    this.entityCode = entityCode;
    this.completenessAffiliate.set(entityCode);
    this.irregularitiesAffiliate.set(entityCode);
    this.coaAffiliate.set(entityCode);

    // Schema is configuration for the CoA table, so fetch it once when the
    // screen starts rather than coupling it to a particular affiliate.
    this.loadCoaSchema();
    this.loadCompleteness();
  }

  /** This screen is now unreachable without an entityCode (ngOnInit
   *  redirects otherwise), so the "back to Landing" link is always shown. */
  get cameFromLanding(): boolean {
    return true;
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

  selectTab(tab: MainTab): void {
    this.tab.set(tab);
    this.error.set(null);

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

  onIrregularitiesPeriodViewChange(view: string): void {
    this.irregularitiesPeriodView.set(view as PeriodView);
  }

  private loadCompleteness(): void {
    if (!this.completenessAffiliate()) return;
    const affiliate = this.completenessAffiliate();
    this.completenessLoading.set(true);
    this.submissionReviewService.getChecklist(affiliate).subscribe({
      next: (checklist) => {
        this.checklist.set(checklist);
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

    forkJoin({
      findings: this.submissionReviewService.getFindings(affiliate, page),
      summary: this.submissionReviewService.getIrregularitiesSummary(affiliate),
    }).subscribe({
      next: ({ findings, summary }) => {
        const overrides = this.findingStatusOverrides();
        this.findings.set(findings.items.map((row) => ({
          ...row,
          status: overrides[`${affiliate}:${row.accountCode}`] ?? row.status,
        })));
        this.irregularitiesTotalPages.set(findings.totalPages);
        this.irregularitiesTotalCount.set(findings.totalCount);
        this.irregularitiesSummary.set(summary);
        this.irregularitiesLoading.set(false);
        this.irregularitiesLoadedFor.add(affiliate);
      },
      error: (err) => {
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
        this.coaRows.set(result.items.map((row) => ({
          ...row,
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
      periodValue: 'coa-month',
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

  priorityStyle(priority: string | undefined) {
    if (priority === 'High') return this.toneStyle('danger');
    if (priority === 'Medium') return this.toneStyle('warning');
    return this.toneStyle('info');
  }

  /* ---------- Irregularities: period-toggle-driven row accessors ---------- */

  findingValue(row: Finding): number | null {
    const view = this.irregularitiesPeriodView();
    if (view === 'monthly') return row.mtd;
    if (view === 'quarterly') return row.qtd;
    return row.ytd;
  }

  findingPrior(row: Finding): number | null {
    const view = this.irregularitiesPeriodView();
    if (view === 'monthly') return row.mtdPrior;
    if (view === 'quarterly') return row.qtdPrior;
    return row.ytdPrior;
  }

  findingDelta(row: Finding): string | null {
    const view = this.irregularitiesPeriodView();
    if (view === 'monthly') return row.mtdDelta;
    if (view === 'quarterly') return row.qtdDelta;
    return row.ytdDelta;
  }

  findingReasoning(row: Finding): string | null {
    const view = this.irregularitiesPeriodView();
    if (view === 'monthly') return row.mtdDeltaObservation;
    if (view === 'quarterly') return row.qtdDeltaObservation;
    return row.ytdDeltaObservation;
  }

  formatIrregularityAmount(value: number | null): string {
    if (value === null || value === undefined) return '—';
    const abs = Math.abs(value).toLocaleString('en-US');
    return value < 0 ? `(${abs})` : abs;
  }

  /** Delta cell tint, driven by priority per the current design: High = red
   *  tint, Medium = amber tint, Low = untinted. Reuses the existing
   *  .flag-high / .flag-medium background classes. */
  deltaTintClass(row: Finding): string {
    if (row.priority === 'High') return 'flag-high';
    if (row.priority === 'Medium') return 'flag-medium';
    return '';
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

  /* ---------- CoA "Confirm Mapping" confirmation dialog ---------- */

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
  

  private confirmCoaMapping(index: number, onSettled?: () => void): void {
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