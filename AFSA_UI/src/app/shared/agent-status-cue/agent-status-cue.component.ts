import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon';

export type AgentCueTone = 'working' | 'complete' | 'attention';

/**
 * In-page status bar for a specialist agent (e.g. "Variance Analysis Agent").
 * Purely presentational + a visibility beacon: it tracks whether it's
 * currently on screen via IntersectionObserver and broadcasts that (plus
 * click-to-open) via window CustomEvents, so a single <app-specialist-agent>
 * panel/FAB placed anywhere on the same page can react without any direct
 * parent/child wiring -- this is what lets the same pair of components be
 * dropped onto multiple screens with different agentName/content.
 */
@Component({
  selector: 'app-agent-status-cue',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './agent-status-cue.component.html',
  styleUrl: './agent-status-cue.component.scss',
})
export class AgentStatusCueComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) agentName!: string;
  @Input({ required: true }) accent!: string;
  @Input({ required: true }) status!: string;
  @Input({ required: true }) summary!: string;
  @Input() tone: AgentCueTone = 'working';

  @ViewChild('cueRef') private readonly cueRef!: ElementRef<HTMLButtonElement>;
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      ([entry]) => this.notifyVisibility(Boolean(entry?.isIntersecting)),
      { threshold: 0.12 },
    );
    this.observer.observe(this.cueRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.notifyVisibility(false);
  }

  private notifyVisibility(visible: boolean): void {
    window.dispatchEvent(new CustomEvent('afra-specialist-anchor-visibility', { detail: { agentName: this.agentName, visible } }));
  }

  openAgent(): void {
    window.dispatchEvent(new CustomEvent('afra-specialist-open', { detail: { agentName: this.agentName } }));
  }
}