import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../core/services/reports.service';
import { ReportCapability, ReportRow } from '../../core/models/reports.model';

const CAPABILITIES: ReportCapability[] = [
  'Affiliate Submission Review',
  'Compliance Monitoring & Benchmarking',
  'Management Reports & Variance Analysis',
  'Financial Statement Integrity Check',
];

const DOT_COLOR: Record<ReportCapability, string> = {
  'Affiliate Submission Review': '#84BD00',
  'Compliance Monitoring & Benchmarking': '#0033A0',
  'Management Reports & Variance Analysis': '#00A3E0',
  'Financial Statement Integrity Check': '#00843D',
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  readonly capabilities = CAPABILITIES;
  readonly dotColor = DOT_COLOR;

  readonly allReports = signal<ReportRow[]>([]);
  readonly search = signal('');
  readonly activeFilter = signal<'All' | ReportCapability>('All');
  readonly generatedIds = signal<Set<string>>(new Set());
  readonly toast = signal(false);

  readonly filteredReports = computed(() => {
    const q = this.search().trim().toLowerCase();
    const filter = this.activeFilter();
    return this.allReports().filter((r) => {
      const matchesFilter = filter === 'All' || r.capability === filter;
      const matchesSearch = !q || r.title.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  readonly groupedReports = computed(() => {
    const groups: { capability: ReportCapability; reports: ReportRow[] }[] = [];
    for (const cap of this.capabilities) {
      const reports = this.filteredReports().filter((r) => r.capability === cap);
      if (reports.length > 0) groups.push({ capability: cap, reports });
    }
    return groups;
  });

  constructor(private readonly reportsService: ReportsService) {}

  ngOnInit(): void {
    this.reportsService.getReports().subscribe((reports) => this.allReports.set(reports));
  }

  setFilter(filter: 'All' | ReportCapability) {
    this.activeFilter.set(filter);
  }

  isGenerated(id: string) {
    return this.generatedIds().has(id);
  }

  generate(report: ReportRow) {
    this.reportsService.generateReport(report.id).subscribe(() => {
      this.generatedIds.update((prev) => new Set(prev).add(report.id));
      this.toast.set(true);
      setTimeout(() => this.toast.set(false), 3000);
    });
  }
}
