import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VarianceService } from '../../core/services/variance.service';
import { VarianceRow } from '../../core/models/variance.model';

@Component({
  selector: 'app-variance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './variance.component.html',
  styleUrl: './variance.component.scss',
})
export class VarianceComponent implements OnInit {
  readonly rows = signal<VarianceRow[]>([]);

  readonly actualPeriod = signal('Q1 2026');
  readonly comparisonPeriod = signal('Q1 2025');
  readonly entity = signal('Group Consolidated');
  readonly currency = signal('SAR (000s)');

  constructor(private readonly varianceService: VarianceService) {}

  ngOnInit(): void {
    this.varianceService.getVarianceRows().subscribe((rows) => this.rows.set(rows));
  }

  formatNumber(value: number): string {
    const abs = Math.abs(value).toLocaleString('en-US');
    return value < 0 ? `(${abs})` : abs;
  }

  varianceColor(value: number): string {
    return value >= 0 ? '#00843D' : '#DC2626';
  }
}
