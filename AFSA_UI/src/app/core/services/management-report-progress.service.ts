import { Injectable, computed, signal } from '@angular/core';

interface StoredProgressState {
  reportGenerated: boolean;
}

const STORAGE_KEY = 'afsa-mgmt-report-progress';

/**
 * Tracks the "Management Report Generator" workflow card's progress
 * client-side, since the Home API's workflow entry for this agent has no
 * real signal to reflect "has a report actually been generated yet."
 * Binary: 0% until the PPTX has been generated at least once this session,
 * 100% after. Persisted to localStorage so it survives navigating away/back
 * and page reloads; reset on a fresh login (see AuthService).
 */
@Injectable({ providedIn: 'root' })
export class ManagementReportProgressService {
  private readonly reportGenerated = signal(false);

  readonly progressPercent = computed(() => (this.reportGenerated() ? 100 : 0));

  constructor() {
    this.restore();
  }

  isReportGenerated(): boolean {
    return this.reportGenerated();
  }

  /** Called once a report generation completes successfully. */
  markReportGenerated(): void {
    if (this.reportGenerated()) return;
    this.reportGenerated.set(true);
    this.persist();
  }

  /** Clears locally-tracked progress, reverting the workflow card to 0%.
   *  Called on a fresh login (see AuthService.setCurrentUser). */
  resetForNewSession(): void {
    this.reportGenerated.set(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  private persist(): void {
    const state: StoredProgressState = { reportGenerated: this.reportGenerated() };
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
      this.reportGenerated.set(!!state.reportGenerated);
    } catch {
      /* ignore corrupt storage */
    }
  }
}