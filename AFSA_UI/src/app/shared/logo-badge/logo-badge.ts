import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo-badge',
  standalone: true,
  template: `
    <div
      class="logo-badge"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.border-radius.px]="borderRadius"
    >
      <img
        src="assets/head.png"
        alt="AFSA"
        [style.width.px]="size * 0.72"
        [style.height.px]="size * 0.72"
      />
    </div>
  `,
  styles: [
    `
      .logo-badge {
        background: linear-gradient(135deg, #84bd00, #00a3e0);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 12px rgba(0, 163, 224, 0.35);
        overflow: hidden;
      }
      img {
        object-fit: contain;
        filter: brightness(0) invert(1);
      }
    `,
  ],
})
export class LogoBadgeComponent {
  @Input() size = 36;
  @Input() borderRadius = 10;
}
