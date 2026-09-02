import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogSegment {
  text: string;
  emphasis?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  /** Dialog heading, e.g. "Confirm CoA Mapping?" */
  @Input() title = 'Are you sure?';

  /** Body copy built as segments so callers can bold specific tokens
   *  (account codes, mapping names, etc.) without resorting to innerHTML. */
  @Input() segments: ConfirmDialogSegment[] = [];

  /** Optional yellow inline warning banner shown under the message. */
  @Input() warning: string | null = null;

  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';

  /** Disables both buttons and swaps the confirm label to a busy state
   *  while the underlying request is in flight. */
  @Input() confirming = false;
  @Input() confirmingLabel = 'Please wait…';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onBackdropClick(): void {
    if (this.confirming) return;
    this.cancelled.emit();
  }

  onCardClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}