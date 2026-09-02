import { Injectable, computed, signal } from '@angular/core';

interface StoredProgressState {
  period: string;
  checkPhaseComplete: boolean;
  totalNotes: number;
  acknowledgedNoteIds: string[];
}

const STORAGE_KEY = 'afsa-compliance-progress';

/**
 * Tracks the "Compliance Monitoring & Benchmarking" workflow card's progress
 * client-side, since no backend field exists for it. Two phases:
 *  - 0%   -> nobody has visited the Compliance screen for this period yet.
 *  - 50%  -> the bulk compliance check across all notes has completed at
 *            least once (success or partial failure both count).
 *  - 50% + (50% * acknowledgedNotes / totalNotes) -> each note the user
 *            explicitly acknowledges on the Compliance screen adds its
 *            share of the remaining 50%.
 * Acknowledgment is one-way (per product decision: no un-acknowledge, and
 * re-running a note's check does not reset its acknowledgment).
 * Persisted to localStorage so it survives navigating away/back and page
 * reloads within the same browser.
 */
@Injectable({ providedIn: 'root' })
export class ComplianceProgressService {
  private readonly period = signal<string>('');
  private readonly checkPhaseComplete = signal(false);
  private readonly totalNotes = signal(0);
  private readonly acknowledgedNoteIds = signal<Set<string>>(new Set());

  constructor() {
    this.restore();
  }

  readonly progressPercent = computed(() => {
    if (!this.checkPhaseComplete()) return 0;
    const total = this.totalNotes();
    if (!total) return 50;
    const acknowledgedFraction = this.acknowledgedNoteIds().size / total;
    return Math.round(50 + acknowledgedFraction * 50);
  });

  isNoteAcknowledged(noteId: string): boolean {
    return this.acknowledgedNoteIds().has(noteId);
  }

  /** Called once the Compliance screen knows the period and note count
   *  (from getNotes()). A genuinely different period starts fresh rather
   *  than carrying over acknowledgments that belong to different notes. */
  setContext(period: string, totalNotes: number): void {
    if (this.period() !== period) {
      this.period.set(period);
      this.checkPhaseComplete.set(false);
      this.acknowledgedNoteIds.set(new Set());
    }
    this.totalNotes.set(totalNotes);
    this.persist();
  }

  /** Called once the bulk compliance check (across all notes) finishes,
   *  regardless of whether every individual note succeeded. */
  markCheckPhaseComplete(): void {
    if (this.checkPhaseComplete()) return;
    this.checkPhaseComplete.set(true);
    this.persist();
  }

  /** Mock acknowledge action — no backend endpoint exists for this yet;
   *  purely local state, persisted to localStorage. */
  acknowledgeNote(noteId: string): void {
    if (this.acknowledgedNoteIds().has(noteId)) return;
    this.acknowledgedNoteIds.update((prev) => new Set(prev).add(noteId));
    this.persist();
  }

  private persist(): void {
    const state: StoredProgressState = {
      period: this.period(),
      checkPhaseComplete: this.checkPhaseComplete(),
      totalNotes: this.totalNotes(),
      acknowledgedNoteIds: Array.from(this.acknowledgedNoteIds()),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as StoredProgressState;
      this.period.set(state.period ?? '');
      this.checkPhaseComplete.set(!!state.checkPhaseComplete);
      this.totalNotes.set(state.totalNotes ?? 0);
      this.acknowledgedNoteIds.set(new Set(state.acknowledgedNoteIds ?? []));
    } catch {
      /* ignore corrupt storage */
    }
  }

  /** Clears all locally-tracked progress (check-phase completion + every
     *  note's acknowledgment), reverting the Compliance workflow card to 0%.
     *  Intended to be called on a fresh login, so this client-only progress
     *  doesn't silently persist across different users/sessions on the same
     *  browser. */
    resetForNewSession(): void {
        this.period.set('');
        this.checkPhaseComplete.set(false);
        this.totalNotes.set(0);
        this.acknowledgedNoteIds.set(new Set());
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }
}