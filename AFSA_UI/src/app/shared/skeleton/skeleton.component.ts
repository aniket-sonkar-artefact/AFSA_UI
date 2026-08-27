import { Component, HostBinding, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `<span class="sk"></span>`,
  styleUrl: './skeleton.component.scss',
})
export class SkeletonComponent {
  @Input() width = '100%';
  @Input() height = '12px';
  @Input() radius = '6px';

  @HostBinding('style.width') get hostWidth() { return this.width; }
  @HostBinding('style.height') get hostHeight() { return this.height; }
  @HostBinding('style.border-radius') get hostRadius() { return this.radius; }
}