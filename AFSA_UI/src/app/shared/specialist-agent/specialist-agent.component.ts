import { Component, Input, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon';

interface ChatMessage {
  id: number;
  role: 'user' | 'agent';
  text: string;
}

function compactRoleLabel(roleLabel: string): string {
  const normalized = roleLabel.toLowerCase();
  if (normalized.includes('variance')) return 'Variance analysis';
  if (normalized.includes('affiliate')) return 'Affiliate follow-up';
  if (normalized.includes('ifrs') || normalized.includes('compliance')) return 'IFRS compliance';
  if (normalized.includes('integrity') || normalized.includes('validation')) return 'Integrity checks';
  if (normalized.includes('report')) return 'Report generation';
  return roleLabel;
}

/**
 * Floating panel + FAB for a specialist agent. Renders once per page
 * (fixed-positioned, so placement in the DOM doesn't matter) and listens for
 * window CustomEvents dispatched by any <app-agent-status-cue> sharing the
 * same [agentName], so the two stay in sync without direct wiring: the FAB
 * only appears once the in-page bar scrolls out of view, and clicking either
 * the bar or the FAB opens the same panel.
 *
 * Entirely mock/static -- there is no backing chat API. `customReply` lets a
 * screen optionally override canned response text per keyword; anything not
 * matched falls back to the same generic acknowledgement used everywhere.
 */
@Component({
  selector: 'app-specialist-agent',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './specialist-agent.component.html',
  styleUrl: './specialist-agent.component.scss',
})
export class SpecialistAgentComponent implements OnInit, OnDestroy {
  @Input({ required: true }) agentName!: string;
  @Input({ required: true }) roleLabel!: string;
  @Input({ required: true }) contextLabel!: string;
  @Input({ required: true }) accent!: string;
  @Input({ required: true }) briefing!: string;
  @Input() suggestions: string[] = [];
  @Input() statusLabel = 'Monitoring';
  @Input() attentionLabel?: string;
  @Input() attentionText?: string;
  /** Optional per-screen custom reply logic; return null/undefined to fall through to the default. */
  @Input() customReply?: (message: string) => string | null | undefined;

  readonly open = signal(false);
  readonly anchorVisible = signal(true);
  readonly input = signal('');
  readonly messages = signal<ChatMessage[]>([]);
  readonly thinking = signal(false);

  readonly compactRole = computed(() => compactRoleLabel(this.roleLabel));
  readonly showFab = computed(() => !this.open() && !this.anchorVisible());

  private nextId = 1;

  private readonly onExternalOpen = (event: Event): void => {
    const detail = (event as CustomEvent<{ agentName?: string }>).detail;
    if (detail?.agentName !== this.agentName) return;
    this.open.set(true);
  };

  private readonly onAnchorVisibility = (event: Event): void => {
    const detail = (event as CustomEvent<{ agentName?: string; visible?: boolean }>).detail;
    if (detail?.agentName !== this.agentName) return;
    this.anchorVisible.set(!!detail.visible);
  };

  ngOnInit(): void {
    window.addEventListener('afra-specialist-open', this.onExternalOpen);
    window.addEventListener('afra-specialist-anchor-visibility', this.onAnchorVisibility);
  }

  ngOnDestroy(): void {
    window.removeEventListener('afra-specialist-open', this.onExternalOpen);
    window.removeEventListener('afra-specialist-anchor-visibility', this.onAnchorVisibility);
  }

  openPanel(): void {
    this.open.set(true);
  }

  closePanel(): void {
    this.open.set(false);
  }

  useSuggestion(text: string): void {
    this.sendMessage(text);
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.sendMessage(this.input());
  }

  send(): void {
    this.sendMessage(this.input());
  }

  private sendMessage(raw: string): void {
    const message = raw.trim();
    if (!message || this.thinking()) return;

    this.messages.update((prev) => [...prev, { id: this.nextId++, role: 'user', text: message }]);
    this.input.set('');
    this.thinking.set(true);

    window.setTimeout(() => {
      const reply = this.customReply?.(message) ?? this.defaultReply(message);
      this.messages.update((prev) => [...prev, { id: this.nextId++, role: 'agent', text: reply }]);
      this.thinking.set(false);
    }, 380);
  }

  private defaultReply(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('why') || normalized.includes('explain') || normalized.includes('reason')) {
      return `I'm using the current ${this.contextLabel.toLowerCase()} output, the available supporting evidence and the solution's configured review rules. I'll keep routine actions autonomous and surface only items that need finance judgment.`;
    }
    if (normalized.includes('continue') || normalized.includes('proceed') || normalized.includes('go ahead')) {
      return `Understood. I'll continue the ${this.roleLabel.toLowerCase()} workflow autonomously and come back only if an exception requires your judgment or approval.`;
    }
    return `I'll continue handling the current ${this.contextLabel.toLowerCase()} workflow autonomously. You can ask for the rationale, respond to a decision I've raised, or intervene if you want to change the normal treatment.`;
  }
}