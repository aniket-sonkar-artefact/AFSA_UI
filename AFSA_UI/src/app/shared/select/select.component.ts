import {
  Component, ElementRef, EventEmitter, HostListener, Input, Output,
  ViewChild, forwardRef, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/** Accepts plain strings (label === value) so simple callers don't need to
 *  map anything, or full {label, value} pairs for API-backed data where the
 *  id and display text differ. */
type SelectOptionInput = string | SelectOption;

function normalizeOption(opt: SelectOptionInput): SelectOption {
  return typeof opt === 'string' ? { label: opt, value: opt } : opt;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  @ViewChild('trigger') private readonly triggerRef?: ElementRef<HTMLButtonElement>;

  /** Swapping this to an API-sourced list later is just pointing it at a
   *  signal/observable-derived array — nothing in the template changes. */
  @Input()
  set options(value: SelectOptionInput[] | null | undefined) {
    this._options.set((value ?? []).map(normalizeOption));
  }
  get options(): SelectOption[] {
    return this._options();
  }
  private readonly _options = signal<SelectOption[]>([]);

  @Input() placeholder = 'Select…';
  @Input() disabled = false;
  /** Focus ring / selected-state / hover colour. Pass a hex value or a
   *  `var(--some-token)` string to match the host screen's theme. */
  @Input() accent = '#0033A0';
  @Input() background?: string;
  @Input() borderColor?: string;
  @Input() compact = false;  
  @Input() centered = false

  @Output() readonly selectionChange = new EventEmitter<string>();

  readonly open = signal(false);
  readonly focusedIndex = signal(-1);

  /** The current value, as a signal — this is what selectedOption() reads,
   *  so it MUST be a signal (not a plain field) for the computed() below to
   *  re-evaluate whenever writeValue()/selectOption() change it. */
  private readonly value = signal<string | null>(null);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly selectedOption = computed(() =>
    this._options().find((o) => o.value === this.value()) ?? null,
  );

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

  writeValue(value: string): void {
    this.value.set(value);
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggle(): void {
    if (this.disabled) return;
    this.open.update((o) => !o);
    if (this.open()) {
      const idx = this._options().findIndex((o) => o.value === this.value());
      this.focusedIndex.set(idx >= 0 ? idx : 0);
    } else {
      this.onTouched();
    }
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
  }

  selectOption(option: SelectOption): void {
    if (option.disabled) return;
    this.value.set(option.value);
    this.onChange(option.value);
    this.selectionChange.emit(option.value);
    this.close();
    this.triggerRef?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.hostRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;
    const opts = this._options();

    switch (event.key) {
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
          this.triggerRef?.nativeElement.focus();
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.open()) this.toggle();
        else {
          const opt = opts[this.focusedIndex()];
          if (opt) this.selectOption(opt);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) this.toggle();
        else this.focusedIndex.update((i) => Math.min(i + 1, opts.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.open()) this.focusedIndex.update((i) => Math.max(i - 1, 0));
        break;
    }
  }
}