import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon';
import { LogoBadgeComponent } from '../logo-badge/logo-badge';
import {
  ActivityItem,
  AgentTask,
  ApprovalItem,
  ChatMessage,
  OrchestratorTab,
  TaskPriority,
  TaskStatus,
} from '../../core/models/orchestrator.model';

/* =========================================================
   MOCK DATA
   ---------------------------------------------------------
   Ported from the Figma reference (AFSAOrchestrator.tsx). This
   panel is explicitly a PoC simulation -- see the footer disclaimer
   in the template -- so the instruction box below (executeInstruction)
   is intentionally simplified from the original's full keyword-routing
   state machine down to a few recognizable commands (pause/resume) plus
   a generic acknowledgement for anything else, rather than porting the
   entire NLP-ish parser.
========================================================= */

const INITIAL_TASKS: AgentTask[] = [
  {
    id: 'affiliate-package',
    title: 'Validate affiliate submission packages',
    solution: 'Affiliate Submission Reviewer',
    agent: 'Submission Completeness Agent',
    status: 'complete',
    priority: 'High',
    progress: 100,
    autonomous: true,
    detail: 'Required files, schedules and submission structure validated.',
  },
  {
    id: 'affiliate-irregularities',
    title: 'Investigate high-priority affiliate irregularities',
    solution: 'Affiliate Submission Reviewer',
    agent: 'Irregularities Agent',
    status: 'running',
    priority: 'High',
    progress: 72,
    autonomous: true,
    detail: 'Monthly, quarterly and yearly checks are being consolidated.',
  },
  {
    id: 'integrity-checks',
    title: 'Run financial statement integrity checks',
    solution: 'Financial Statement Integrity & Formatting',
    agent: 'Integrity Agents',
    status: 'running',
    priority: 'Medium',
    progress: 78,
    autonomous: true,
    detail: 'Footings, cross-references and consistency checks are in progress.',
  },
  {
    id: 'compliance',
    title: 'Run disclosure compliance review',
    solution: 'Compliance Monitoring & Benchmarking',
    agent: 'Compliance Agents',
    status: 'running',
    priority: 'Medium',
    progress: 42,
    autonomous: true,
    detail: 'Available notes are being assessed against the relevant IFRS requirements.',
  },
  {
    id: 'management-report',
    title: 'Generate management report and commentary',
    solution: 'Management Report Generator',
    agent: 'Management Reporting Agents',
    status: 'queued',
    priority: 'Low',
    progress: 0,
    autonomous: true,
    detail: 'Queued until the currently open upstream review tasks are sufficiently complete.',
  },
];

const INITIAL_ACTIVITY: ActivityItem[] = [
  {
    id: 1,
    time: 'Now',
    title: 'Integrity checks continuing automatically',
    detail: 'Footings and cross-reference validation are running while the affiliate review continues.',
    kind: 'autonomous',
  },
  {
    id: 2,
    time: '2m ago',
    title: 'IFRS compliance review started',
    detail: 'AFRA delegated the available disclosure checks to the compliance agents.',
    kind: 'autonomous',
  },
  {
    id: 3,
    time: '4m ago',
    title: 'Affiliate irregularity review reprioritized',
    detail: 'High-priority findings were moved ahead of routine review items.',
    kind: 'system',
  },
  {
    id: 4,
    time: '7m ago',
    title: 'Submission package validation completed',
    detail: 'The completeness agent validated the available affiliate reporting package.',
    kind: 'autonomous',
  },
];

const INITIAL_APPROVALS: ApprovalItem[] = [
  {
    id: 'approval-irregularity',
    title: 'Close material affiliate irregularity',
    detail: 'Supporting schedule has been retrieved and classification validated.',
    requestedBy: 'Irregularities Agent',
    status: 'pending',
  },
  {
    id: 'approval-integrity',
    title: 'Resolve material integrity exception',
    detail: 'The exception has been isolated and supporting evidence is available for review.',
    requestedBy: 'Integrity Agent',
    status: 'pending',
  },
  {
    id: 'approval-report',
    title: 'Release final management report',
    detail: 'Approval will be required after dependent review tasks complete.',
    requestedBy: 'Management Reporting Agent',
    status: 'pending',
  },
];

const QUICK_PROMPTS = [
  'Re-run affiliate irregularities using a SAR 250k threshold',
  'Compare high-priority findings to Q1 2025 before the report',
  'Run the remaining IFRS compliance checks',
];

function priorityWeight(priority: TaskPriority): number {
  if (priority === 'High') return 0;
  if (priority === 'Medium') return 1;
  return 2;
}

function statusLabel(status: TaskStatus): string {
  if (status === 'complete') return 'Complete';
  if (status === 'running') return 'Running';
  if (status === 'queued') return 'Queued';
  if (status === 'approval') return 'Approval';
  return 'Paused';
}

@Component({
  selector: 'app-afsa-orchestrator',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, LogoBadgeComponent],
  templateUrl: './afsa-orchestrator.component.html',
  styleUrl: './afsa-orchestrator.component.scss',
})
export class AfsaOrchestratorComponent {
  readonly open = signal(false);
  readonly tab = signal<OrchestratorTab>('plan');
  readonly autopilot = signal(true);
  readonly openSolutionsOnly = signal(true);

  readonly tasks = signal<AgentTask[]>(INITIAL_TASKS);
  readonly activity = signal<ActivityItem[]>(INITIAL_ACTIVITY);
  readonly approvals = signal<ApprovalItem[]>(INITIAL_APPROVALS);
  readonly chat = signal<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Q1 group reporting is in progress. I am running affiliate irregularity review, IFRS compliance and integrity checks in parallel. I will continue autonomously and surface decisions that require approval.',
    },
  ]);
  readonly input = signal('');
  readonly quickPrompts = QUICK_PROMPTS;

  private nextId = 100;

  readonly runningCount = computed(() => this.tasks().filter((t) => t.status === 'running').length);
  readonly completeCount = computed(() => this.tasks().filter((t) => t.status === 'complete').length);
  readonly pendingApprovalsCount = computed(() => this.approvals().filter((a) => a.status === 'pending').length);

  readonly objectivePercent = computed(() => {
    const tasks = this.tasks();
    if (!tasks.length) return 0;
    const sum = tasks.reduce((acc, t) => acc + (t.status === 'complete' ? 100 : t.progress), 0);
    return Math.round(sum / tasks.length);
  });

  readonly orderedTasks = computed(() => {
    const statusWeight: Record<TaskStatus, number> = { running: 0, approval: 1, queued: 2, paused: 3, complete: 4 };
    return [...this.tasks()].sort((a, b) => {
      const diff = statusWeight[a.status] - statusWeight[b.status];
      return diff !== 0 ? diff : priorityWeight(a.priority) - priorityWeight(b.priority);
    });
  });

  readonly visibleTasks = computed(() =>
    this.openSolutionsOnly() ? this.orderedTasks().filter((t) => t.status !== 'complete') : this.orderedTasks(),
  );

  readonly latestAssistantMessage = computed(() => {
    const messages = this.chat();
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  });

  toggleOpen(): void {
    this.open.update((o) => !o);
  }

  close(): void {
    this.open.set(false);
  }

  selectTab(tab: OrchestratorTab): void {
    this.tab.set(tab);
  }

  toggleAutopilot(): void {
    const next = !this.autopilot();
    this.autopilot.set(next);
    this.addActivity(
      next ? 'Autonomous execution resumed' : 'Autonomous execution paused',
      next
        ? 'AFRA can continue launching eligible downstream tasks as dependencies clear.'
        : 'AFRA will keep monitoring but will not start new queued tasks until execution resumes.',
      'user',
    );
  }

  toggleOpenSolutionsOnly(): void {
    this.openSolutionsOnly.update((v) => !v);
  }

  statusLabel(status: TaskStatus): string {
    return statusLabel(status);
  }

  approveItem(id: string): void {
    const item = this.approvals().find((a) => a.id === id);
    this.approvals.update((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'approved' as const } : a)));
    if (item) {
      this.addActivity(`Approved: ${item.title}`, `Requested by ${item.requestedBy}.`, 'approval');
    }
  }

  rejectItem(id: string): void {
    const item = this.approvals().find((a) => a.id === id);
    this.approvals.update((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rejected' as const } : a)));
    if (item) {
      this.addActivity(`Rejected: ${item.title}`, `Requested by ${item.requestedBy}.`, 'approval');
    }
  }

  useQuickPrompt(prompt: string): void {
    this.input.set(prompt);
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.input().trim();
    if (!text) return;

    this.chat.update((prev) => [...prev, { id: this.nextId++, role: 'user', text }]);
    this.input.set('');

    const normalized = text.toLowerCase();
    if (normalized.includes('pause')) {
      this.autopilot.set(false);
      this.addAssistantMessage(
        'Autonomous execution is paused. I will keep the current state and continue monitoring, but I will not start new queued work until you tell me to resume.',
      );
      return;
    }
    if (normalized.includes('resume') || normalized.includes('continue')) {
      this.autopilot.set(true);
      this.addAssistantMessage(
        'Autonomous execution is back on. I will continue the plan, respect approval gates, and start the next eligible task when capacity is available.',
      );
      return;
    }

    this.addAssistantMessage(
      `Noted — I'll factor "${text}" into the current plan and surface anything that needs your review.`,
    );
  }

  private addActivity(title: string, detail: string, kind: ActivityItem['kind']): void {
    this.activity.update((prev) => [
      { id: this.nextId++, time: 'Now', title, detail, kind },
      ...prev.map((item) => (item.time === 'Now' ? { ...item, time: '1m ago' } : item)),
    ]);
  }

  private addAssistantMessage(text: string): void {
    this.chat.update((prev) => [...prev, { id: this.nextId++, role: 'assistant', text }]);
  }
}