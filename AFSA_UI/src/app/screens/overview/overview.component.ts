import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SubmissionReviewService } from '../../core/services/submission-review.service';
import { IntegrityService } from '../../core/services/integrity.service';
import { Affiliate, CoaRow, Finding } from '../../core/models/submission-review.model';
import { FootingRow, XRefRow } from '../../core/models/integrity.model';

interface CapabilityCard {
  title: string;
  route: string;
  desc: string;
  accentBorder: string;
}

interface IssueItem {
  label: string;
  sublabel: string;
  route: string;
  priority: 'High' | 'Medium';
}

const CAPABILITY_CARDS: CapabilityCard[] = [
  { title: 'Affiliate Submission Review', route: '/submission', desc: 'Review submission completeness, irregular values and Group CoA mappings by affiliate.', accentBorder: '#84BD00' },
  { title: 'Compliance Monitoring & Benchmarking', route: '/ifrs', desc: 'Run on-demand IFRS compliance checks against note tables and editable narratives.', accentBorder: '#0033A0' },
  { title: 'Management Reports & Variance Analysis', route: '/variance', desc: 'Compare reporting periods and review key movements across Group financial results.', accentBorder: '#00A3E0' },
  { title: 'Financial Statement Integrity Check', route: '/integrity', desc: 'Validate statement-to-note cross-references and footings and subfootings.', accentBorder: '#00843D' },
];

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent implements OnInit {
  readonly capabilityCards = CAPABILITY_CARDS;

  private readonly findingsA = signal<Finding[]>([]);
  private readonly findingsB = signal<Finding[]>([]);
  private readonly coaA = signal<CoaRow[]>([]);
  private readonly coaB = signal<CoaRow[]>([]);
  private readonly xrefRows = signal<XRefRow[]>([]);
  private readonly footingRows = signal<FootingRow[]>([]);

  readonly affiliatesInReview = 2;

  readonly irregularitiesRequiringReview = computed(
    () =>
      this.findingsA().filter((f) => f.status !== 'Closed').length +
      this.findingsB().filter((f) => f.status !== 'Closed').length,
  );

  readonly coaMappingsRequiringAttention = computed(
    () =>
      [...this.coaA(), ...this.coaB()].filter(
        (r) => !r.confirmed && (r.originalStatus === 'Low Confidence' || r.originalStatus === 'Unmapped'),
      ).length,
  );

  readonly integrityExceptionsOpen = computed(
    () =>
      this.xrefRows().filter((r) => r.status === 'Flagged' && !r.completed).length +
      this.footingRows().filter((r) => r.result !== 'Pass' && !r.completed).length,
  );

  readonly kpis = computed(() => {
    const irregularities = this.irregularitiesRequiringReview();
    const coaAttention = this.coaMappingsRequiringAttention();
    const integrityOpen = this.integrityExceptionsOpen();
    return [
      { value: String(this.affiliatesInReview), label: 'Affiliates in Review', color: '#0033A0' },
      { value: String(irregularities), label: 'Irregularities Requiring Review', color: irregularities > 0 ? '#DC2626' : '#00843D' },
      { value: String(coaAttention), label: 'CoA Mappings Requiring Attention', color: coaAttention > 0 ? '#D97706' : '#00843D' },
      { value: String(integrityOpen), label: 'Integrity Exceptions Open', color: integrityOpen > 0 ? '#DC2626' : '#00843D' },
    ];
  });

  readonly issues = computed<IssueItem[]>(() => {
    const items: IssueItem[] = [];

    (['A', 'B'] as Affiliate[]).forEach((aff) => {
      const findings = aff === 'A' ? this.findingsA() : this.findingsB();
      findings.forEach((f) => {
        if (f.status !== 'Closed') {
          items.push({
            label: `Affiliate ${aff} \u00b7 ${f.account}`,
            sublabel: `Irregularity \u2014 ${f.status}`,
            route: '/submission',
            priority: f.severity === 'High' ? 'High' : 'Medium',
          });
        }
      });
    });

    (['A', 'B'] as Affiliate[]).forEach((aff) => {
      const rows = aff === 'A' ? this.coaA() : this.coaB();
      rows.forEach((r) => {
        if (!r.confirmed && (r.originalStatus === 'Low Confidence' || r.originalStatus === 'Unmapped')) {
          items.push({
            label: `Affiliate ${aff} \u00b7 Account ${r.code}`,
            sublabel: 'CoA mapping requires review',
            route: '/submission',
            priority: r.originalStatus === 'Unmapped' ? 'High' : 'Medium',
          });
        }
      });
    });

    this.xrefRows().forEach((r) => {
      if (r.status === 'Flagged' && !r.completed) {
        items.push({ label: r.statement, sublabel: 'Cross-reference exception', route: '/integrity', priority: 'High' });
      }
    });

    this.footingRows().forEach((r) => {
      if (r.result !== 'Pass' && !r.completed) {
        items.push({ label: r.table, sublabel: r.exceptionType ?? 'Footing exception', route: '/integrity', priority: 'High' });
      }
    });

    return items;
  });

  constructor(
    private readonly submissionReviewService: SubmissionReviewService,
    private readonly integrityService: IntegrityService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    forkJoin({
      findingsA: this.submissionReviewService.getFindings('A'),
      findingsB: this.submissionReviewService.getFindings('B'),
      coaA: this.submissionReviewService.getCoaRows('A'),
      coaB: this.submissionReviewService.getCoaRows('B'),
      xref: this.integrityService.getXRefRows(),
      footings: this.integrityService.getFootingRows(),
    }).subscribe(({ findingsA, findingsB, coaA, coaB, xref, footings }) => {
      this.findingsA.set(findingsA);
      this.findingsB.set(findingsB);
      this.coaA.set(coaA);
      this.coaB.set(coaB);
      this.xrefRows.set(xref);
      this.footingRows.set(footings);
    });
  }

  navigate(route: string) {
    this.router.navigate([route]);
  }
}
