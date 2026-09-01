import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, delay, of } from 'rxjs';
import { IconComponent } from '../../shared/icon/icon';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';

/* =========================================================
   NOTE ON THIS REWRITE
   ---------------------------------------------------------
   Rebuilt to match the approved "Affiliate Submission Overview"
   design (header + 3 overall KPI cards + affiliate table with a
   hover point-of-contact card), replacing the previous card-grid
   layout entirely.

   DATA SOURCING: no backing endpoint exists yet that returns this
   combined shape (per-affiliate completeness/irregularities/CoA
   percentages + point-of-contact details in one call), so this
   screen currently calls a local mock function
   (`fetchAffiliateOverview`) that returns the exact same shape a
   real endpoint would, wrapped in `delay(...)` to simulate network
   latency. The loading skeleton is driven off the same `loading`
   signal either way.

   TO SWITCH TO A REAL API: replace the body of `fetchAffiliateOverview()`
   with an HttpClient call returning `Observable<AffiliateOverviewResponse>`
   -- nothing else in this component needs to change, since `loadOverview()`
   already just subscribes to whatever that method returns.
========================================================= */

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

interface AffiliateOverviewResponse {
  overallMetrics: OverallMetric[];
  affiliates: AffiliateRow[];
}

function mockAffiliateOverview(): AffiliateOverviewResponse {
  return {
    overallMetrics: [
      {
        label: 'Overall Submission Completeness',
        percent: 81,
        detail: '17 of 21 required submission items complete',
        accent: '#B5651D',
      },
      {
        label: 'Overall Irregularities',
        percent: 0,
        detail: '0 of 6 irregularities resolved',
        accent: '#C0504D',
      },
      {
        label: 'Overall CoA Mapping',
        percent: 96,
        detail: '127 of 132 mappings high-confidence or resolved',
        accent: '#00843D',
      },
    ],
    affiliates: [
      {
        code: 'SA',
        name: 'SABIC',
        entityCode: 'SA01',
        period: 'Q1 2026',
        completenessPercent: 64,
        completenessFraction: '7/11 complete',
        irregularitiesPercent: 0,
        irregularitiesFraction: '0/4 resolved',
        coaMappingPercent: 95,
        coaMappingFraction: '63/66 mapped',
        contact: {
          name: 'SABIC Representative',
          role: 'Finance Submission Point of Contact',
          company: 'SABIC',
          email: 'xxx.xxx@sabic.com',
          phone: '+966 5X XXX XXXX',
        },
        pending: { submission: 4, irregularities: 4, mappings: 3 },
      },
      {
        code: 'PE',
        name: 'PetroRabigh',
        entityCode: 'PE02',
        period: 'Q1 2026',
        completenessPercent: 100,
        completenessFraction: '10/10 complete',
        irregularitiesPercent: 0,
        irregularitiesFraction: '0/2 resolved',
        coaMappingPercent: 97,
        coaMappingFraction: '64/66 mapped',
        contact: {
          name: 'PetroRabigh Representative',
          role: 'Finance Submission Point of Contact',
          company: 'PetroRabigh',
          email: 'xxx.xxx@petrorabigh.com',
          phone: '+966 5X XXX XXXX',
        },
        pending: { submission: 0, irregularities: 2, mappings: 2 },
      },
    ],
  };
}

@Component({
  selector: 'app-affiliate-landing',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonComponent],
  templateUrl: './affiliate-landing.component.html',
  styleUrl: './affiliate-landing.component.scss',
})
export class AffiliateLandingComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overallMetrics = signal<OverallMetric[]>([]);
  readonly affiliates = signal<AffiliateRow[]>([]);

  /** Which affiliate row's point-of-contact popover is currently shown. */
  readonly hoveredEntityCode = signal<string | null>(null);

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  private loadOverview(): void {
    this.loading.set(true);
    this.error.set(null);

    this.fetchAffiliateOverview().subscribe({
      next: (data) => {
        this.overallMetrics.set(data.overallMetrics);
        this.affiliates.set(data.affiliates);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the affiliate submission overview.');
        this.loading.set(false);
      },
    });
  }

  /** Mock data source -- see file header note for how to swap this for a
   * real HttpClient call without touching the rest of the component. */
  private fetchAffiliateOverview(): Observable<AffiliateOverviewResponse> {
    return of(mockAffiliateOverview()).pipe(delay(700));
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