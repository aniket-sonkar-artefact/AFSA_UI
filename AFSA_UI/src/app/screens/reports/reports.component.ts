import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/icon/icon';
import { ReportsService } from '../../core/services/reports.service';
import { ReportCapability, ReportRow } from '../../core/models/reports.model';

const CAPABILITIES: ReportCapability[] = [
  'Affiliate Submission Review',
  'Compliance Monitoring & Benchmarking',
  'Management Reports & Variance Analysis',
  'Financial Statement Integrity Check',
];

const CAPABILITY_ACCENT: Record<ReportCapability, string> = {
  'Affiliate Submission Review': '#1F497D',
  'Compliance Monitoring & Benchmarking': '#C0504D',
  'Management Reports & Variance Analysis': '#8064A2',
  'Financial Statement Integrity Check': '#4BACC6',
};

const CAPABILITY_DARK_ACCENT: Record<ReportCapability, string> = {
  'Affiliate Submission Review': '#82AFE0',
  'Compliance Monitoring & Benchmarking': '#E47A77',
  'Management Reports & Variance Analysis': '#B79AD4',
  'Financial Statement Integrity Check': '#62C9E2',
};

const CAPABILITY_DARK_SURFACE: Record<ReportCapability, string> = {
  'Affiliate Submission Review': '#274F7C',
  'Compliance Monitoring & Benchmarking': '#704044',
  'Management Reports & Variance Analysis': '#514268',
  'Financial Statement Integrity Check': '#245B6A',
};

const FILTER_ALL_ACCENT = '#64748B';
const FILTER_ALL_DARK_ACCENT = '#A8B6C7';
const FILTER_ALL_DARK_SURFACE = '#506176';

type FilterValue = 'All' | ReportCapability;

interface FilterVars {
  '--filter-accent': string;
  '--filter-dark-accent': string;
  '--filter-dark-surface': string;
}

interface GroupVars {
  '--group-accent': string;
  '--group-soft': string;
  '--group-soft-strong': string;
  '--group-dark-accent': string;
  '--group-dark-surface': string;
  '--group-dark-soft': string;
  '--group-dark-soft-strong': string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  readonly capabilities = CAPABILITIES;
  readonly filterOptions: FilterValue[] = ['All', ...CAPABILITIES];

  readonly allReports = signal<ReportRow[]>([]);
  readonly search = signal('');
  readonly activeFilter = signal<FilterValue>('All');
  readonly collapsedGroups = signal<Set<ReportCapability>>(new Set());
  readonly toast = signal<string | null>(null);

  readonly filteredReports = computed(() => {
    const q = this.search().trim().toLowerCase();
    const filter = this.activeFilter();
    return this.allReports().filter((r) => {
      const matchesFilter = filter === 'All' || r.capability === filter;
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.meta.toLowerCase().includes(q) ||
        r.capability.toLowerCase().includes(q);
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

  setFilter(filter: FilterValue) {
    this.activeFilter.set(filter);
  }

  filterVars(filter: FilterValue): FilterVars {
    const lightAccent = filter === 'All' ? FILTER_ALL_ACCENT : CAPABILITY_ACCENT[filter];
    const darkAccent = filter === 'All' ? FILTER_ALL_DARK_ACCENT : CAPABILITY_DARK_ACCENT[filter];
    const darkSurface = filter === 'All' ? FILTER_ALL_DARK_SURFACE : CAPABILITY_DARK_SURFACE[filter];
    return {
      '--filter-accent': lightAccent,
      '--filter-dark-accent': darkAccent,
      '--filter-dark-surface': darkSurface,
    };
  }

  groupVars(capability: ReportCapability): GroupVars {
    const accent = CAPABILITY_ACCENT[capability];
    const darkAccent = CAPABILITY_DARK_ACCENT[capability];
    const darkSurface = CAPABILITY_DARK_SURFACE[capability];
    return {
      '--group-accent': accent,
      '--group-soft': `${accent}0D`,
      '--group-soft-strong': `${accent}18`,
      '--group-dark-accent': darkAccent,
      '--group-dark-surface': darkSurface,
      '--group-dark-soft': `${darkAccent}12`,
      '--group-dark-soft-strong': `${darkAccent}20`,
    };
  }

  isCollapsed(capability: ReportCapability) {
    return this.collapsedGroups().has(capability);
  }

  toggleGroup(capability: ReportCapability) {
    this.collapsedGroups.update((prev) => {
      const next = new Set(prev);
      if (next.has(capability)) {
        next.delete(capability);
      } else {
        next.add(capability);
      }
      return next;
    });
  }

  private showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 3000);
  }

  download(report: ReportRow) {
    this.reportsService.generateReport(report.id).subscribe(() => {
      this.showToast('Management Report PPTX downloaded');
    });
  }

  generate(report: ReportRow) {
    this.reportsService.generateReport(report.id).subscribe(() => {
      this.showToast(`${report.title} generated`);
    });
  }
}
