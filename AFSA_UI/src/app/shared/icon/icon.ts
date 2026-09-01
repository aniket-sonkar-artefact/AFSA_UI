import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  | 'home'
  | 'file-text'
  | 'check-circle'
  | 'bar-chart'
  | 'shield'
  | 'archive'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'search'
  | 'log-out'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'check'
  | 'arrow-right'
  | 'alert-triangle'
  | 'upload'
  | 'presentation'
  | 'template'
  | 'download'
  | 'refresh'
  | 'clock'
  | 'menu'
  | 'x'
  | 'dollar'
  | 'trending-up'
  | 'lock'
  | 'image'
  | 'camera'
  | 'layers'
  | 'expand'
  | 'translate'
  | 'scale'
  | 'trending-down'
  | 'user';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <ng-container [ngSwitch]="name">
        <ng-container *ngSwitchCase="'home'">
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M9 21v-7h6v7" />
        </ng-container>
        <ng-container *ngSwitchCase="'file-text'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h6" />
        </ng-container>
        <ng-container *ngSwitchCase="'check-circle'">
          <path d="M9 11l2 2 4-4" />
          <path d="M12 22c4.5-2.1 7-5.5 7-10V5l-7-3-7 3v7c0 4.5 2.5 7.9 7 10z" />
        </ng-container>
        <ng-container *ngSwitchCase="'bar-chart'">
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20V7" />
        </ng-container>
        <ng-container *ngSwitchCase="'shield'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="m8 15 2.2 2.2L16 11.5" />
        </ng-container>
        <ng-container *ngSwitchCase="'archive'">
          <path d="M6 2h9l5 5v15H6z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h8M9 17h8" />
        </ng-container>
        <ng-container *ngSwitchCase="'settings'">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </ng-container>
        <ng-container *ngSwitchCase="'sun'">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </ng-container>
        <ng-container *ngSwitchCase="'moon'">
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
        </ng-container>
        <ng-container *ngSwitchCase="'search'">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </ng-container>
        <ng-container *ngSwitchCase="'log-out'">
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
        </ng-container>
        <ng-container *ngSwitchCase="'chevron-left'">
          <path d="M15 18l-6-6 6-6" />
        </ng-container>
        <ng-container *ngSwitchCase="'chevron-right'">
          <path d="M9 18l6-6-6-6" />
        </ng-container>
        <ng-container *ngSwitchCase="'menu'">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </ng-container>
        <ng-container *ngSwitchCase="'x'">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </ng-container>
        <ng-container *ngSwitchCase="'check'">
          <path d="M20 6L9 17l-5-5" />
        </ng-container>
        <ng-container *ngSwitchCase="'arrow-right'">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </ng-container>
        <ng-container *ngSwitchCase="'alert-triangle'">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        </ng-container>
        <ng-container *ngSwitchCase="'chevron-down'">
          <path d="m6 9 6 6 6-6" />
        </ng-container>
        <ng-container *ngSwitchCase="'upload'">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </ng-container>
        <ng-container *ngSwitchCase="'presentation'">
          <path d="M4 3h16v12H4z" />
          <path d="M8 21l4-6 4 6" />
          <path d="M12 15v6" />
          <path d="M8 8h8" />
          <path d="M8 11h5" />
        </ng-container>
        <ng-container *ngSwitchCase="'template'">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </ng-container>
        <ng-container *ngSwitchCase="'download'">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </ng-container>
        <ng-container *ngSwitchCase="'refresh'">
          <path d="M20 11a8 8 0 1 0-2.34 5.66" />
          <path d="M20 4v7h-7" />
        </ng-container>
        <ng-container *ngSwitchCase="'clock'">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </ng-container>
        <ng-container *ngSwitchCase="'dollar'">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6.5v11M15 9.2c0-1.2-1.34-2.2-3-2.2s-3 .9-3 2.2 1.34 2 3 2 3 .8 3 2-1.34 2.2-3 2.2-3-1-3-2.2" />
        </ng-container>
        <ng-container *ngSwitchCase="'trending-up'">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 6h6v6" />
        </ng-container>
        <ng-container *ngSwitchCase="'lock'">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </ng-container>
        <ng-container *ngSwitchCase="'image'">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M5 18l5-5 3 3 3-3.5L20 18" />
        </ng-container>
        <ng-container *ngSwitchCase="'camera'">
          <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </ng-container>
        <ng-container *ngSwitchCase="'layers'">
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </ng-container>
        <ng-container *ngSwitchCase="'expand'">
          <path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4" />
        </ng-container>
        <ng-container *ngSwitchCase="'translate'">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
        </ng-container>
        <ng-container *ngSwitchCase="'scale'">
          <path d="M12 3v18M7 21h10" />
          <path d="M5 7l-3 6a3 3 0 0 0 6 0l-3-6zM19 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
          <path d="M4 7h16M12 3l-7 4M12 3l7 4" />
        </ng-container>
        <ng-container *ngSwitchCase="'trending-down'">
          <path d="M3 7l6 6 4-4 8 8" />
          <path d="M15 18h6v-6" />
        </ng-container>
        <ng-container *ngSwitchCase="'user'">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </ng-container>
      </ng-container>
    </svg>
  `,
})
export class IconComponent {
  @Input() name!: IconName;
  @Input() size = 14;
  @Input() strokeWidth = 1.8;
}