import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { IconComponent } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { AffiliateOverviewService } from '../../core/services/affiliate-overview.service';
import { AffiliateOverviewMetric, AffiliateOverviewRowApi } from '../../core/models/affiliate-overview.model';
import { AgentStatusCueComponent } from '../../shared/agent-status-cue/agent-status-cue.component';
import { SpecialistAgentComponent } from '../../shared/specialist-agent/specialist-agent.component';
import { PETRORABIGH_LOGO_DATA_URI, SABIC_LOGO_DATA_URI } from '../../shared/affiliate-logos.constant';

/* =========================================================
   NOTE ON THIS REWRITE
   ---------------------------------------------------------
   Now backed by the real overview endpoint:
   GET /api/v1/affiliate-submission-review/overview?period_key={period_key}

   The endpoint does not return per-affiliate point-of-contact details or a
   pending-items breakdown, so those two pieces stay mock data
   (deterministically seeded from the affiliate's entityName, same approach
   used on the Submission Review header) until a real endpoint exists for
   them. Nothing else on this screen is mocked anymore.
========================================================= */

const PERIOD_KEY = '2026Q1';

interface OverallMetric {
  label: string;
  percent: number;
  detail: string;
  accent: string;
}

interface AffiliateContact {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
}

interface AffiliatePendingItems {
  submission: number;
  irregularities: number;
  mappings: number;
}

interface AffiliateRow {
  code: string;
  name: string;
  logo: string;
  entityCode: string;
  period: string;
  completenessPercent: number;
  completenessFraction: string;
  irregularitiesPercent: number;
  irregularitiesFraction: string;
  coaMappingPercent: number;
  coaMappingFraction: string;
  contact: AffiliateContact;
  pending: AffiliatePendingItems;
}

/* ---------- Mock contact / pending items (see file header note) ---------- */

function mockContactFor(affiliateName: string): AffiliateContact {
  const slug = affiliateName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return {
    name: `${affiliateName} Representative`,
    role: 'Finance Submission Point of Contact',
    company: affiliateName,
    email: `xxx.xxx@${slug || 'affiliate'}.com`,
    phone: '+966 5X XXX XXXX',
  };
}

/** Pending items per category are NOT mocked — they're the real
 *  "not yet done" counts the API already gives us (denominator - numerator)
 *  for each metric. Only the point-of-contact card below is mock data. */
function pendingItemsFor(row: AffiliateOverviewRowApi): AffiliatePendingItems {
  return {
    submission: row.submissionCompleteness.denominator - row.submissionCompleteness.numerator,
    irregularities: row.irregularities.denominator - row.irregularities.numerator,
    mappings: row.coaMapping.denominator - row.coaMapping.numerator,
  };
}

function avatarInitials(affiliateName: string): string {
  const words = affiliateName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return affiliateName.slice(0, 2).toUpperCase();
}

/** Matches the real affiliate logo asset by name substring -- returns an
 *  empty string for any affiliate without a known logo, so the template can
 *  fall back to the initials badge instead of a broken image. */
const AFFILIATE_LOGO_BY_ENTITY_CODE: Record<string, string> = {
  '2010': SABIC_LOGO_DATA_URI,
  '2380': PETRORABIGH_LOGO_DATA_URI,
};

function affiliateLogoFor(entityCode: string): string {
  return AFFILIATE_LOGO_BY_ENTITY_CODE[entityCode] ?? '';
}

function formatPeriodLabel(periodKey: string): string {
  const m = periodKey.match(/^(\d{4})Q(\d+)$/);
  return m ? `Q${m[2]} ${m[1]}` : periodKey;
}

function fractionLabel(metric: AffiliateOverviewMetric, suffix: string): string {
  return `${metric.numerator}/${metric.denominator} ${suffix}`;
}

@Component({
  selector: 'app-affiliate-landing',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonComponent, AgentStatusCueComponent, SpecialistAgentComponent],
  templateUrl: './affiliate-landing.component.html',
  styleUrl: './affiliate-landing.component.scss',
})
export class AffiliateLandingComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overallMetrics = signal<OverallMetric[]>([]);
  readonly affiliates = signal<AffiliateRow[]>([]);

  readonly agentBriefing =
    'I am monitoring affiliate submission readiness, managing missing-input follow-ups, tracking affiliate responses and rerunning the affected checks as new files arrive. Routine affiliate interaction stays autonomous; I will only involve Finance when an exception requires judgment.';

  readonly agentSuggestions = ['Show current follow-up status', 'What happens next?'];

  /** Which affiliate row's point-of-contact popover is currently shown. */
  readonly hoveredEntityCode = signal<string | null>(null);

  constructor(
    private readonly router: Router,
    private readonly affiliateOverviewService: AffiliateOverviewService,
  ) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  private loadOverview(): void {
    this.loading.set(true);
    this.error.set(null);

    this.affiliateOverviewService
      .getOverview(PERIOD_KEY)
      .pipe(
        catchError((err) => {
          console.error(err);
          this.error.set('Could not load the affiliate submission overview.');
          return of(null);
        }),
      )
      .subscribe((data) => {
        this.loading.set(false);
        if (!data) return;

        const periodLabel = formatPeriodLabel(data.period);

        this.overallMetrics.set([
          {
            label: 'Overall Submission Completeness',
            percent: data.submissionCompleteness.percentage,
            detail: `${data.submissionCompleteness.numerator} of ${data.submissionCompleteness.denominator} required submission items complete`,
            accent: '#B5651D',
          },
          {
            label: 'Overall Irregularities',
            percent: data.irregularities.percentage,
            detail: `${data.irregularities.numerator} of ${data.irregularities.denominator} irregularities resolved`,
            accent: '#C0504D',
          },
          {
            label: 'Overall CoA Mapping',
            percent: data.coaMapping.percentage,
            detail: `${data.coaMapping.numerator} of ${data.coaMapping.denominator} mappings high-confidence or resolved`,
            accent: '#00843D',
          },
        ]);

        this.affiliates.set(
          data.affiliates.map((row) => ({
            code: avatarInitials(row.entityName),
            name: row.entityName,
            logo: affiliateLogoFor(row.entityCode),
            entityCode: row.entityCode,
            period: periodLabel,
            completenessPercent: row.submissionCompleteness.percentage,
            completenessFraction: fractionLabel(row.submissionCompleteness, 'complete'),
            irregularitiesPercent: row.irregularities.percentage,
            irregularitiesFraction: fractionLabel(row.irregularities, 'resolved'),
            coaMappingPercent: row.coaMapping.percentage,
            coaMappingFraction: fractionLabel(row.coaMapping, 'mapped'),
            contact: mockContactFor(row.entityName),
            pending: pendingItemsFor(row),
          })),
        );
      });
  }

  showContact(entityCode: string): void {
    this.hoveredEntityCode.set(entityCode);
  }

  hideContact(): void {
    this.hoveredEntityCode.set(null);
  }

  contactFor(row: AffiliateRow): AffiliateContact {
    return row.contact;
  }

  pendingTotal(row: AffiliateRow): number {
    return row.pending.submission + row.pending.irregularities + row.pending.mappings;
  }

  selectAffiliate(row: AffiliateRow): void {
    // Carry the display name shown on this page (e.g. "SABIC") through to
    // the review screen's header via router state, so the name the person
    // just clicked is exactly what they see next -- the real affiliate API
    // may return a different (longer/legal) name for the same entity code.
    this.router.navigate(['/submission/review', row.entityCode], { state: { affiliateName: row.name } });
  }

  retry(): void {
    this.loadOverview();
  }
}