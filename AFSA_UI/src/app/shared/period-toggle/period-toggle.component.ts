import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PeriodToggleOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-period-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './period-toggle.component.html',
  styleUrl: './period-toggle.component.scss',
})
export class PeriodToggleComponent {
  @Input() options: PeriodToggleOption[] = [];
  @Input() selected = '';
  /** 'compact' = small pill (period toggles inside table headers).
   *  'tabs' = larger pill matching the main section tab bar. */
  @Input() variant: 'compact' | 'tabs' = 'compact';
  @Output() selectedChange = new EventEmitter<string>();

  get selectedIndex(): number {
    const idx = this.options.findIndex((o) => o.value === this.selected);
    return idx === -1 ? 0 : idx;
  }

  select(value: string): void {
    if (value === this.selected) return;
    this.selectedChange.emit(value);
  }
}