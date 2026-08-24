import { Component, Input } from '@angular/core';

/**
 * Generic shimmering placeholder box. Deliberately dumb — has no idea what
 * screen it's used in. Each screen composes several of these inside its own
 * existing layout containers (same CSS classes as the real content) so the
 * skeleton automatically matches that screen's actual structure.
 *
 * Usage: <app-skeleton width="60%" height="14px" radius="6px"></app-skeleton>
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `<span class="sk" [style.width]="width" [style.height]="height" [style.border-radius]="radius"></span>`,
  styleUrl: './skeleton.component.scss',
})
export class SkeletonComponent {
  @Input() width = '100%';
  @Input() height = '12px';
  @Input() radius = '6px';
}
