import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { IconComponent, IconName } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { HomeService } from '../../core/services/home.service';
import { HomeApiData, HomeApiKpiValue } from '../../core/models/home.model';
import { ComplianceProgressService } from '../../core/services/compliance-progress.service';
import { ManagementReportProgressService } from '../../core/services/management-report-progress.service';
import { AuthService } from '../../core/services/auth.service';
import { PETRORABIGH_LOGO_DATA_URI, SABIC_LOGO_DATA_URI } from '../../shared/affiliate-logos.constant';

/* =========================================================
   NOTE ON THIS REWRITE
   ---------------------------------------------------------
   Fully backed by POST /api/v1/home now. All previous mock data
   (performance metrics, affiliate performance, workflow status
   cards/stepper) and the old multi-service fan-out (Submission,
   Integrity, Compliance) are gone -- the Home endpoint returns
   everything this screen needs in one call, including per-agent
   workflow progress that used to be estimated client-side.

   Two things this API does NOT provide, so they're omitted rather
   than fabricated (as the old mock did):
   - Per-card SLA / elapsed time -- no timing data exists upstream.
   - "Coming soon" pipeline stages (Preliminary Results, Intercompany
     Elimination, Cash Flow Analysis, FS Translation) have no agent_key
     yet, so they stay hardcoded as locked/coming-soon stepper nodes.
========================================================= */

const PERIOD = '2026Q1';

interface PerformanceMetric {
  label: string;
  value: string;
  unit: string;
  yoy: string;
  yoyPositive: boolean;
  icon: IconName;
  accent: string;
  sparklinePoints: string;
}

interface AffiliatePerformanceRow {
  code: string;
  name: string;
  sector: string;
  logo: string;
  revenue: string;
  yoy: string;
  yoyPositive: boolean;
  pctOfGroupRevenue: number;
  accent: string;
  isTopContributor: boolean;
}

interface PendingStep {
  label: string;
  assignee: string;
  role: string;
  priority: 'High' | 'Medium' | 'Low';
}

/** No backing API for SLA timers or pending-step detail exists yet -- both
 *  stay static mock, keyed by the same agent_key used everywhere else. */
const SLA_MOCK: Record<string, { elapsed: string | null; sla: string; overSla: boolean }> = {
  affiliate_submission_reviewer: { elapsed: '12m', sla: 'TBD', overSla: false },
  compliance_monitoring_benchmarking: { elapsed: '3m', sla: 'TBD', overSla: false },
  management_report_generator: { elapsed: null, sla: 'TBD', overSla: false },
  financial_statement_integrity_formatting: { elapsed: '18m', sla: 'TBD', overSla: false },
};

const PENDING_STEPS_MOCK: Record<string, PendingStep[]> = {
  affiliate_submission_reviewer: [
    { label: 'CoA Mapping Review', assignee: 'Mohammed K.', role: 'FC&AG', priority: 'High' },
    { label: 'Irregularity Sign-off', assignee: 'Ahmed S.', role: 'FC&AG', priority: 'High' },
  ],
  compliance_monitoring_benchmarking: [
    { label: 'Disclosure Exception Review', assignee: 'Lynn M.', role: 'FC&RD Analyst', priority: 'High' },
    { label: 'Final Compliance Sign-off', assignee: 'Finance Reviewer', role: 'FC&RD', priority: 'Medium' },
  ],
  management_report_generator: [
    { label: 'Final Review & Approval', assignee: 'Salma H.', role: 'Finance Director', priority: 'High' },
    { label: 'Report Generation', assignee: 'System', role: 'Automated', priority: 'Low' },
  ],
  financial_statement_integrity_formatting: [
    { label: 'Cross-Reference Exception Review', assignee: 'Noor A.', role: 'FRG', priority: 'High' },
    { label: 'Footing Exception Sign-off', assignee: 'Khalid M.', role: 'FRG', priority: 'Medium' },
  ],
};

type StageStatus = 'in-progress' | 'complete' | 'pending' | 'attention' | 'coming-soon';

interface ReportingStage {
  label: string;
  route: string | null;
  status: StageStatus;
  accent: string;
}

interface StatusCard {
  agentKey: string; // new
  label: string;
  status: StageStatus;
  statusLabel: string;
  percent: number;
  pendingSteps: number;
  route: string;
  accent: string;
  elapsed: string | null; // new
  sla: string; // new
  overSla: boolean; // new
}

const ATTENTION_ACCENT = '#C0504D';

/** Attention/alert states always render red regardless of the module's own
 * brand color -- "Requires Attention" is a universal alarm color, not a
 * per-module identity color. */
function effectiveAccent(status: StageStatus, moduleAccent: string): string {
  return status === 'attention' ? ATTENTION_ACCENT : moduleAccent;
}

function toStageStatus(status: string): StageStatus {
  switch (status.toLowerCase()) {
    case 'complete':
    case 'completed':
      return 'complete';
    case 'in_progress':
    case 'in-progress':
      return 'in-progress';
    case 'attention':
    case 'needs_attention':
    case 'requires_attention':
      return 'attention';
    default:
      return 'pending';
  }
}

function stageStatusLabel(status: StageStatus): string {
  switch (status) {
    case 'complete': return 'Complete';
    case 'in-progress': return 'In Progress';
    case 'attention': return 'Requires Attention';
    case 'pending': return 'Pending';
    default: return 'Coming Soon';
  }
}

interface KpiDisplayConfig {
  label: string;
  icon: IconName;
  accent: string;
}

const KPI_DISPLAY_CONFIG: Record<string, KpiDisplayConfig> = {
  group_revenue: { label: 'Group Revenue', icon: 'camera', accent: '#0033A0' },
  net_profit: { label: 'Net Profit', icon: 'dollar-sign', accent: '#00A3E0' },
  ebitda: { label: 'EBITDA', icon: 'line-chart', accent: '#00843D' },
  group_cash_position: { label: 'Group Cash Position', icon: 'banknote', accent: '#84BD00' },
};

function humanizeId(id: string): string {
  return id.split('_').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

function kpiDisplayConfig(id: string): KpiDisplayConfig {
  return KPI_DISPLAY_CONFIG[id] ?? { label: humanizeId(id), icon: 'trending-up', accent: '#64748B' };
}

interface AffiliateDisplayConfig {
  code: string;
  sector: string;
  accent: string;
  logo: string;
}

const AFFILIATE_DISPLAY_CONFIG: Record<string, AffiliateDisplayConfig> = {
  sabic: { code: 'SBC', sector: 'Chemicals & Materials', accent: '#00A3E0', logo: SABIC_LOGO_DATA_URI },
  petro: { code: 'PR', sector: 'Refining & Petrochemicals', accent: '#1F497D', logo: PETRORABIGH_LOGO_DATA_URI },
};

function affiliateDisplayConfig(name: string): AffiliateDisplayConfig {
  return (
    AFFILIATE_DISPLAY_CONFIG[name.toLowerCase()] ?? {
      code: name.slice(0, 3).toUpperCase(),
      sector: '—',
      accent: '#64748B',
      logo: '',
    }
  );
}

interface StageOrderEntry {
  key: string | null;
  label: string;
  route: string | null;
  accent: string;
}

/** Fixed pipeline order. Entries with a null key have no backing agent yet
 *  and always render as locked "coming-soon" stepper nodes. */
const STAGE_ORDER: StageOrderEntry[] = [
  { key: 'affiliate_submission_reviewer', label: 'Affiliate Submission Reviewer', route: '/submission', accent: '#1F497D' },
  { key: null, label: 'Preliminary Results Solution', route: null, accent: '#64748B' },
  { key: null, label: 'Intercompany Elimination & Reconciliation', route: null, accent: '#64748B' },
  { key: null, label: 'Cash Flow Statement Analysis & Review', route: null, accent: '#64748B' },
  { key: 'compliance_monitoring_benchmarking', label: 'Compliance Monitoring & Benchmarking', route: '/ifrs', accent: '#C0504D' },
  { key: 'management_report_generator', label: 'Management Report Generator', route: '/mgmtreport', accent: '#8064A2' },
  { key: 'financial_statement_integrity_formatting', label: 'Financial Statement Integrity and Formatting', route: '/integrity', accent: '#4BACC6' }, // was missing "_formatting"
  { key: null, label: 'FS Translation & Terminology Management', route: null, accent: '#64748B' },
];

function findValue(values: HomeApiKpiValue[], period: string): number | null {
  return values.find((v) => v.period === period)?.value ?? null;
}

function computeYoy(current: number, prior: number): number | null {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

function formatYoy(yoy: number): string {
  return `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}% YoY`;
}

function formatThousands(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatCompactSar(value: number): string {
  value = value * 1000;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  //26150000
  console.log('Affialiate Reveneue  - ', value);

  if (abs >= 1_000_000_000) {
    const billions = abs / 1_000_000_000;
    return `${sign}SAR ${billions.toFixed(billions >= 100 ? 0 : 1)}B`;
  }
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}SAR ${millions.toFixed(millions >= 100 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    return `${sign}SAR ${thousands.toFixed(thousands >= 100 ? 0 : 1)}K`;
  }
  return `${sign}SAR ${Math.round(abs)}`;
}

function formatPeriodLabel(periodKey: string): string {
  const m = periodKey.match(/^(\d{4})Q(\d+)$/);
  return m ? `Q${m[2]} ${m[1]}` : periodKey;
}

/** Builds an SVG polyline (viewBox "0 0 100 34") entirely from the KPI's
 *  own historical values -- however many periods the API returns. Higher
 *  values render closer to the top, matching the original hand-authored
 *  mock curves, but the shape now genuinely reflects the data. */
function buildSparklinePoints(values: HomeApiKpiValue[]): string {
  if (!values.length) return '0,34 100,34';
  const sorted = [...values].sort((a, b) => a.period.localeCompare(b.period));
  const nums = sorted.map((v) => v.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const stepX = sorted.length > 1 ? 100 / (sorted.length - 1) : 0;

  return sorted
    .map((v, i) => {
      const x = sorted.length > 1 ? i * stepX : 50;
      const y = 30 - ((v.value - min) / range) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** "2026-09-01 17:22:07 KSA" -- KSA is UTC+3 with no DST. */
function parseKsaTimestamp(raw: string): Date | null {
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - 3, +mi, +s));
}

function formatRelativeTime(raw: string): string {
  const date = parseKsaTimestamp(raw);
  if (!date) return '';
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Updated just now';
  if (diffMin < 60) return `Updated ${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `Updated ${diffHr} hr${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `Updated ${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  private readonly homeData = signal<HomeApiData | null>(null);

  readonly periodLabel = computed(() => (this.homeData() ? formatPeriodLabel(this.homeData()!.period) : ''));
  readonly updatedAgo = computed(() => {
    const workflow = this.homeData()?.workflow ?? [];
    if (!workflow.length) return '';
    const latest = workflow.reduce((max, w) => (w.updated_at > max ? w.updated_at : max), workflow[0].updated_at);
    return formatRelativeTime(latest);
  });

  readonly performanceMetrics = computed<PerformanceMetric[]>(() => {
  const data = this.homeData();
  if (!data) return [];

  return data.kpis.map((kpi) => {
    const config = kpiDisplayConfig(kpi.id);
    return {
      label: config.label,
      value: formatThousands(kpi.current_value),
      unit: data.unit,
      yoy: formatYoy(kpi.yoy_pct),
      yoyPositive: kpi.yoy_pct >= 0,
      icon: config.icon,
      accent: config.accent,
      sparklinePoints: buildSparklinePoints(kpi.values),
    };
  });
});

readonly affiliatePerformance = computed<AffiliatePerformanceRow[]>(() => {
    const data = this.homeData();
    if (!data || !data.affiliates.length) return [];

    // Use the actual Group Revenue KPI as the denominator, not the sum of
    // affiliate revenues -- affiliates may not account for 100% of group
    // revenue, so these two totals aren't necessarily the same.
    const groupRevenueKpi = data.kpis.find((k) => k.id === 'group_revenue');
    const groupRevenue = groupRevenueKpi?.current_value || 1;

    return [...data.affiliates]
      .sort((a, b) => b.current_value - a.current_value)
      .map((a, index) => {
        const config = affiliateDisplayConfig(a.name);
        return {
          code: config.code,
          name: a.name,
          sector: config.sector,
          logo: config.logo,
          revenue: formatCompactSar(a.current_value),
          yoy: formatYoy(a.yoy_pct),
          yoyPositive: a.yoy_pct >= 0,
          pctOfGroupRevenue: Math.round((a.current_value / groupRevenue) * 1000) / 10,
          accent: config.accent,
          isTopContributor: index === 0, // sorted desc, so index 0 is always the top revenue contributor
        };
      });
  });

  // Defaults to collapsed per requirement.
  readonly performanceCollapsed = signal(true);

  togglePerformanceSection(): void {
    this.performanceCollapsed.update((prev) => !prev);
  }

  readonly expandedCardKey = signal<string | null>(null);

  readonly expandedCard = computed(() => this.statusCards().find((c) => c.agentKey === this.expandedCardKey()) ?? null);

  togglePendingSteps(agentKey: string, event: Event): void {
    event.stopPropagation();
    this.expandedCardKey.update((current) => (current === agentKey ? null : agentKey));
  }

  pendingStepsFor(agentKey: string): PendingStep[] {
    return PENDING_STEPS_MOCK[agentKey] ?? [];
  }

  readonly statusCards = computed<StatusCard[]>(() => {
    const data = this.homeData();
    if (!data) return [];
    const workflowMap = new Map(data.workflow.map((w) => [w.agent_key, w]));

    return STAGE_ORDER.filter((s) => s.key !== null).map((s) => {
      const item = workflowMap.get(s.key!);
      const status = item ? toStageStatus(item.status) : 'pending';

      let percent = item?.progress_pct ?? 0;
      if (s.key === 'compliance_monitoring_benchmarking') {
        percent = this.complianceProgress.progressPercent();
      } else if (s.key === 'management_report_generator') {
        percent = this.managementReportProgress.progressPercent();
      }

      const sla = SLA_MOCK[s.key!] ?? { elapsed: null, sla: '—', overSla: false };

      return {
        agentKey: s.key!,
        label: s.label,
        status,
        statusLabel: stageStatusLabel(status),
        percent,
        pendingSteps: item?.pending_steps ?? 0,
        route: s.route!,
        accent: effectiveAccent(status, s.accent),
        elapsed: sla.elapsed,
        sla: sla.sla,
        overSla: sla.overSla,
      };
    });
});

  readonly reportingStages = computed<ReportingStage[]>(() => {
    const data = this.homeData();
    const workflowMap = new Map((data?.workflow ?? []).map((w) => [w.agent_key, w]));

    return STAGE_ORDER.map((s) => {
      if (!s.key) {
        return { label: s.label, route: null, status: 'coming-soon' as StageStatus, accent: '#64748B' };
      }
      const item = workflowMap.get(s.key);
      const status = item ? toStageStatus(item.status) : 'coming-soon';
      return { label: s.label, route: s.route, status, accent: effectiveAccent(status, s.accent) };
    });
  });

  constructor(
    private readonly homeService: HomeService,
    private readonly router: Router,
    private readonly complianceProgress: ComplianceProgressService,
    private readonly authService: AuthService,
    private readonly managementReportProgress: ManagementReportProgressService,
  ) {}

  ngOnInit(): void {
    this.loadHome();
  }

  readonly welcomeName = computed(() => {
    const fullName = this.authService.currentUser()?.name?.trim() ?? '';
    const firstName = fullName.split(/\s+/)[0];
    return firstName || 'there';
  });

  private loadHome(): void {
    this.loading.set(true);
    this.error.set(null);

    this.homeService
      .getHome(PERIOD)
      .pipe(
        catchError((err) => {
          console.error(err);
          this.error.set('Could not load the group performance overview.');
          return of(null);
        }),
      )
      .subscribe((data) => {
        this.loading.set(false);
        if (data) this.homeData.set(data);
      });
  }

  retry(): void {
    this.loadHome();
  }

  goToStatements(): void {
    this.router.navigate(['/statements']);
  }

  navigate(route: string | null): void {
    if (!route) return;
    this.router.navigate([route]);
  }
}