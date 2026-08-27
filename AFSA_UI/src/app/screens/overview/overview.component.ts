import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { IconComponent, IconName } from '../../shared/icon/icon';
import { SubmissionReviewService } from '../../core/services/submission-review.service';
import { IntegrityService } from '../../core/services/integrity.service';
import { CoaAffiliate, CoaRow, Finding } from '../../core/models/submission-review.model';

interface CapabilityCard {
  title: string;
  route: string;
  desc: string;
  accent: string;
  icon: IconName;
}

interface ProcessStage {
  label: string;
  route: string;
  status: 'In Review' | 'Ready' | 'Requires Attention' | 'Pending';
  accent: string;
}

interface Kpi {
  value: string;
  label: string;
  color: string;
  attention: boolean;
}

const CAPABILITY_CARDS: CapabilityCard[] = [
  {
    title: 'Affiliate Submission Review',
    route: '/submission',
    desc: 'Review submission completeness, irregular values and Group CoA mappings by affiliate.',
    accent: '#1F497D',
    icon: 'file-text',
  },
  {
    title: 'Compliance Monitoring & Benchmarking',
    route: '/ifrs',
    desc: 'Run on-demand IFRS compliance checks against note tables and editable narratives.',
    accent: '#C0504D',
    icon: 'check-circle',
  },
  {
    title: 'Management Reports & Variance Analysis',
    route: '/variance',
    desc: 'Compare reporting periods and review key movements across Group financial results.',
    accent: '#8064A2',
    icon: 'bar-chart',
  },
  {
    title: 'Financial Statement Integrity Check',
    route: '/integrity',
    desc: 'Validate statement-to-note cross-references and footings and subfootings.',
    accent: '#4BACC6',
    icon: 'shield',
  },
];

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent implements OnInit {
  readonly capabilityCards = CAPABILITY_CARDS;

  private readonly findingsA = signal<Finding[]>([]);
  private readonly findingsB = signal<Finding[]>([]);
  private readonly coaA = signal<CoaRow[]>([]);
  private readonly coaB = signal<CoaRow[]>([]);
  private readonly integrityFlagged = signal(0);

  readonly affiliatesInReview = 2;

  readonly irregularitiesRequiringReview = computed(
    () =>
      this.findingsA().filter((f) => f.status !== 'Closed').length +
      this.findingsB().filter((f) => f.status !== 'Closed').length,
  );

  readonly coaMappingsRequiringAttention = computed(
    () =>
      [...this.coaA(), ...this.coaB()].filter(
        (r) => !r.confirmed && (r.mappingStatus === 'Low Confidence' || r.mappingStatus === 'Unmapped'),
      ).length,
  );

  readonly integrityExceptionsOpen = computed(() => this.integrityFlagged());

  readonly affiliateItemsRequiringAttention = computed(
    () => this.irregularitiesRequiringReview() + this.coaMappingsRequiringAttention(),
  );

  readonly totalIssues = computed(
    () =>
      this.irregularitiesRequiringReview() +
      this.coaMappingsRequiringAttention() +
      this.integrityExceptionsOpen(),
  );

  readonly kpis = computed<Kpi[]>(() => {
    const irregularities = this.irregularitiesRequiringReview();
    const coaAttention = this.coaMappingsRequiringAttention();
    const integrityOpen = this.integrityExceptionsOpen();
    return [
      { value: String(this.affiliatesInReview), label: 'Affiliates in Review', color: '#0033A0', attention: false },
      {
        value: String(irregularities),
        label: 'Irregularities Requiring Review',
        color: irregularities > 0 ? '#DC2626' : '#00843D',
        attention: irregularities > 0,
      },
      {
        value: String(coaAttention),
        label: 'CoA Mappings Requiring Attention',
        color: coaAttention > 0 ? '#D97706' : '#00843D',
        attention: coaAttention > 0,
      },
      {
        value: String(integrityOpen),
        label: 'Integrity Exceptions Open',
        color: integrityOpen > 0 ? '#DC2626' : '#00843D',
        attention: integrityOpen > 0,
      },
    ];
  });

  readonly processStages = computed<ProcessStage[]>(() => [
    {
      label: 'Affiliate Review',
      route: '/submission',
      status: this.affiliateItemsRequiringAttention() > 0 ? 'In Review' : 'Ready',
      accent: '#1F497D',
    },
    { label: 'Compliance', route: '/ifrs', status: 'Ready', accent: '#C0504D' },
    { label: 'Variance Analysis', route: '/variance', status: 'Ready', accent: '#8064A2' },
    {
      label: 'Integrity Check',
      route: '/integrity',
      status: this.integrityExceptionsOpen() > 0 ? 'Requires Attention' : 'Ready',
      accent: '#4BACC6',
    },
    {
      label: 'Reporting',
      route: '/reports',
      status: this.totalIssues() > 0 ? 'Pending' : 'Ready',
      accent: '#64748B',
    },
  ]);

  constructor(
    private readonly submissionReviewService: SubmissionReviewService,
    private readonly integrityService: IntegrityService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    forkJoin({
      findingsA: this.submissionReviewService.getFindings('2010', 1).pipe(map((result) => result.items)),
      findingsB: this.submissionReviewService.getFindings('2380', 1).pipe(map((result) => result.items)),
      coaA: this.submissionReviewService.getCoaRows('sabic', 1).pipe(map((result) => result.items)),
      coaB: this.submissionReviewService.getCoaRows('rabigh', 1).pipe(map((result) => result.items)),
      integritySummary: this.integrityService.getSummary(),
    }).subscribe(({ findingsA, findingsB, coaA, coaB, integritySummary }) => {
      this.findingsA.set(findingsA);
      this.findingsB.set(findingsB);
      this.coaA.set(coaA);
      this.coaB.set(coaB);
      this.integrityFlagged.set(integritySummary.totalFlagged);
    });
  }

  capabilityStatus(card: CapabilityCard): string {
    if (card.route === '/submission') {
      const n = this.affiliateItemsRequiringAttention();
      return n > 0 ? `${n} items requiring review` : 'Review clear';
    }
    if (card.route === '/ifrs') return 'Compliance review ready';
    if (card.route === '/variance') return 'Variance analysis ready';
    if (card.route === '/integrity') {
      const n = this.integrityExceptionsOpen();
      return n > 0 ? `${n} exceptions open` : 'Integrity clear';
    }
    return '';
  }

  navigate(route: string) {
    this.router.navigate([route]);
  }
}
