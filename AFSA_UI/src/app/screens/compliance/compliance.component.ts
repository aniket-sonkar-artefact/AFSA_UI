import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin, switchMap, map } from 'rxjs';
import { catchError, of } from 'rxjs';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { IconComponent } from '../../shared/icon/icon';
import { ComplianceService } from '../../core/services/compliance.service';
import { ResponsiveService } from '../../core/services/responsive.service';
import {
  ComplianceCheckResult,
  ComplianceNoteSummary,
  NoteSchema,
  NoteTableData,
} from '../../core/models/compliance.model';
import { ComplianceProgressService } from '../../core/services/compliance-progress.service';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-compliance',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, PaginationComponent, IconComponent],
  templateUrl: './compliance.component.html',
  styleUrl: './compliance.component.scss',
})
export class ComplianceComponent implements OnInit {
  // ---- notes list / header ----
  readonly loadingNotes = signal(true);
  readonly notesError = signal<string | null>(null);
  readonly period = signal('');
  readonly notes = signal<ComplianceNoteSummary[]>([]);
  readonly selectedNoteId = signal<string | null>(null);

  readonly selectedNote = computed(() => this.notes().find((n) => n.noteId === this.selectedNoteId()) ?? null);

  readonly formattedPeriod = computed(() => {
    const m = this.period().match(/^(\d{4})Q(\d)$/);
    return m ? `Q${m[2]} ${m[1]}` : this.period();
  });

  // ---- note detail (schema + narrative) ----
  readonly loadingDetail = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly schema = signal<NoteSchema | null>(null);
  readonly narrativeDraft = signal('');

  // ---- table data (per active table within the selected note) ----
  readonly activeTableId = signal<string | null>(null);
  readonly tableLoading = signal(false);
  readonly tableError = signal<string | null>(null);
  readonly tableData = signal<NoteTableData | null>(null);
  private readonly pageByTable = new Map<string, number>();

  readonly activeTableSchema = computed(() => {
    const schema = this.schema();
    const tableId = this.activeTableId();
    if (!schema || !tableId) return null;
    return schema.tables.find((t) => t.id === tableId) ?? null;
  });

  // ---- compliance check (run in bulk for all notes on load) ----
  readonly checkRunning = signal(false);
  readonly checkError = signal<string | null>(null);
  readonly computingAverage = signal(false);
  private readonly checkResultsByNote = signal<Record<string, ComplianceCheckResult>>({});
  readonly checkFailedNoteIds = signal<Set<string>>(new Set());

  private apiAverageComplianceScoreFallback = 0;

  readonly checkResult = computed(() => {
    const id = this.selectedNoteId();
    return id ? this.checkResultsByNote()[id] ?? null : null;
  });

  readonly notMetResults = computed(() => this.checkResult()?.results.filter((r) => !r.isMet) ?? []);

  readonly selectedNoteCheckFailed = computed(() => {
    const id = this.selectedNoteId();
    return id ? this.checkFailedNoteIds().has(id) : false;
  });

  // ---- KPI row ----
  // ifrsNotesCheckedCount / compliantNotesCount stay sourced from the API.
  // averageComplianceScore is recomputed client-side from the bulk check
  // results (mean confidence across notes that succeeded), falling back to
  // the API's value if every check fails.
  readonly ifrsNotesCheckedCount = signal(0);
  readonly compliantNotesCount = signal(0);
  readonly averageComplianceScore = signal(0);

  aiStatus = signal('Analyzing disclosure');

  private aiStatusMessages = [
    'Analyzing disclosure',
    'Reviewing IFRS requirements',
    'Checking compliance criteria',
    'Evaluating disclosure gaps',
    'Cross-checking requirements',
    'Finalizing compliance assessment'
  ];

  private aiStatusInterval?: ReturnType<typeof setInterval>;

  readonly confidenceColor = computed(() => {
    const r = this.checkResult();
    if (!r) return '#0033A0';
    return r.complianceConfidence >= 85 ? '#00843D' : r.complianceConfidence >= 70 ? '#B45309' : '#DC2626';
  });

  constructor(
    private readonly complianceService: ComplianceService,
    private readonly router: Router,
    private readonly complianceProgress: ComplianceProgressService,
    readonly responsive: ResponsiveService,
  ) {}

  ngOnInit(): void {
    this.loadNotes();
  }

  private loadNotes() {
    this.loadingNotes.set(true);
    this.notesError.set(null);

    this.complianceService
      .getNotes()
      .pipe(
        catchError((err) => {
          this.notesError.set('Could not load IFRS notes. Please try again.');
          console.error(err);
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.loadingNotes.set(false);
        if (!res) return;

        this.period.set(res.period);
        this.notes.set(res.notes);

        this.complianceProgress.setContext(res.period, res.notes.length);

        this.ifrsNotesCheckedCount.set(res.ifrsNotesCheckedCount);
        this.compliantNotesCount.set(res.compliantNotesCount);

        this.apiAverageComplianceScoreFallback = res.averageComplianceScore;

        const first = res.notes[0];
        if (first) this.selectNote(first.noteId);

        this.runAllComplianceChecks(res.notes);
      });
  }

  selectNote(noteId: string) {
    if (this.selectedNoteId() === noteId && this.schema()) return;

    this.selectedNoteId.set(noteId);
    this.schema.set(null);
    this.activeTableId.set(null);
    this.tableData.set(null);
    this.detailError.set(null);
    this.loadingDetail.set(true);

    this.complianceService
      .getSchema(noteId)
      .pipe(
        catchError((err) => {
          this.detailError.set('Could not load this note. Please try again.');
          console.error(err);
          return of(null);
        }),
      )
      .subscribe((schema) => {
        if (!schema) {
          this.loadingDetail.set(false);
          return;
        }

        this.schema.set(schema);
        const firstTable = schema.tables[0];
        this.activeTableId.set(firstTable?.id ?? null);

        forkJoin({
          table: firstTable
            ? this.complianceService.getTableData(
                noteId,
                schema.tables.length > 1 ? firstTable.id : null,
                1,
                PAGE_SIZE,
              )
            : of(null),
          narrative: this.complianceService.getNarrative(noteId),
        })
          .pipe(
            catchError((err) => {
              this.detailError.set('Could not load this note. Please try again.');
              console.error(err);
              return of(null);
            }),
          )
          .subscribe((result) => {
            this.loadingDetail.set(false);
            if (!result) return;

            if (result.table && firstTable) {
              this.tableData.set(result.table);
              this.pageByTable.set(firstTable.id, 1);
            }
            this.narrativeDraft.set(result.narrative.narrative);
            // Compliance checks now run in bulk from loadNotes(), so no
            // per-note auto-run is triggered here.
          });
      });
  }

  selectTable(tableId: string) {
    if (this.activeTableId() === tableId) return;
    this.activeTableId.set(tableId);
    const page = this.pageByTable.get(tableId) ?? 1;
    this.loadTablePage(tableId, page);
  }

  goToPage(page: number) {
    const tableId = this.activeTableId();
    if (!tableId) return;
    this.loadTablePage(tableId, page);
  }

  private loadTablePage(tableId: string, page: number) {
    const noteId = this.selectedNoteId();
    const schema = this.schema();
    if (!noteId || !schema) return;

    this.tableLoading.set(true);
    this.tableError.set(null);

    this.complianceService
      .getTableData(noteId, schema.tables.length > 1 ? tableId : null, page, PAGE_SIZE)
      .pipe(
        catchError((err) => {
          this.tableError.set('Could not load this table. Please try again.');
          console.error(err);
          return of(null);
        }),
      )
      .subscribe((data) => {
        this.tableLoading.set(false);
        if (!data) return;
        this.tableData.set(data);
        this.pageByTable.set(tableId, page);
      });
  }

  /**
   * Runs the compliance check for every note in parallel. Populates
   * checkResultsByNote for successes and checkFailedNoteIds for failures,
   * then recomputes averageComplianceScore from the mean confidence of the
   * notes that succeeded (Option A: partial failures don't block the KPI —
   * it's just computed from whatever came back). If every note fails, the
   * KPI keeps the API's original value set in loadNotes().
   */
  private runAllComplianceChecks(notes: ComplianceNoteSummary[]) {
    if (!notes.length) return;

    this.checkRunning.set(true);
    this.checkError.set(null);
    this.aiStatus.set(this.aiStatusMessages[0]);

    let statusIndex = 0;
    this.aiStatusInterval = setInterval(() => {
      statusIndex++;
      if (statusIndex < this.aiStatusMessages.length) {
        this.aiStatus.set(this.aiStatusMessages[statusIndex]);
      }
    }, 2800);

    const checks$ = notes.map((n) =>
      this.complianceService.getNarrative(n.noteId).pipe(
        switchMap((narrative) => this.complianceService.runComplianceCheck(n.noteId, narrative.narrative)),
        map((result) => ({ noteId: n.noteId, result, failed: false as const })),
        catchError((err) => {
          console.error(`Compliance check failed for note ${n.noteId}`, err);
          return of({ noteId: n.noteId, result: null as ComplianceCheckResult | null, failed: true as const });
        }),
      ),
    );

    forkJoin(checks$)
      .pipe(
        finalize(() => {
          if (this.aiStatusInterval) {
            clearInterval(this.aiStatusInterval);
            this.aiStatusInterval = undefined;
          }
          this.checkRunning.set(false);
        }),
      )
      .subscribe((outcomes) => {
        const succeeded: Record<string, ComplianceCheckResult> = {};
        const failedIds = new Set<string>();

        for (const outcome of outcomes) {
          if (outcome.failed || !outcome.result) {
            failedIds.add(outcome.noteId);
          } else {
            succeeded[outcome.noteId] = outcome.result;
          }
        }

        this.checkResultsByNote.set(succeeded);
        this.checkFailedNoteIds.set(failedIds);
        this.complianceProgress.markCheckPhaseComplete();

        const scores = Object.values(succeeded).map((r) => r.complianceConfidence);
        if (scores.length) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          this.averageComplianceScore.set(Math.round(avg));
        }

        if (failedIds.size > 0 && !scores.length) {
          this.averageComplianceScore.set(this.apiAverageComplianceScoreFallback);
          this.checkError.set('Compliance checks failed for all notes.');
        }
      });
  }

  readonly selectedNoteAcknowledged = computed(() => {
    const id = this.selectedNoteId();
    return id ? this.complianceProgress.isNoteAcknowledged(id) : false;
  });

  acknowledgeSelectedNote(): void {
    const id = this.selectedNoteId();
    if (!id) return;
    this.complianceProgress.acknowledgeNote(id);
  }

  /**
   * Manual retry for a single note (e.g. wired to a retry action later).
   * Independent of the bulk flow above.
   */
  runCheck() {
    const noteId = this.selectedNoteId();
    if (!noteId || this.checkRunning()) return;

    this.checkRunning.set(true);
    this.checkError.set(null);
    this.aiStatus.set(this.aiStatusMessages[0]);

    let statusIndex = 0;

    this.aiStatusInterval = setInterval(() => {
      statusIndex++;

      if (statusIndex < this.aiStatusMessages.length) {
        this.aiStatus.set(this.aiStatusMessages[statusIndex]);
      }
    }, 2800);

    this.complianceService
      .runComplianceCheck(noteId, this.narrativeDraft())
      .pipe(
        catchError((err) => {
          this.checkError.set('Compliance check failed. Please try again.');
          console.error(err);
          return of(null);
        }),
        finalize(() => {
          if (this.aiStatusInterval) {
            clearInterval(this.aiStatusInterval);
            this.aiStatusInterval = undefined;
          }

          this.aiStatus.set('Finalizing compliance assessment');
          this.checkRunning.set(false);
        }),
      )
      .subscribe((result) => {
        if (!result) return;

        this.checkResultsByNote.update((prev) => ({
          ...prev,
          [noteId]: result,
        }));

        this.checkFailedNoteIds.update((prev) => {
          const next = new Set(prev);
          next.delete(noteId);
          return next;
        });

        const scores = Object.values(this.checkResultsByNote()).map((r) => r.complianceConfidence);
        if (scores.length) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          this.averageComplianceScore.set(Math.round(avg));
        }
      });
  }

  cellValue(item: Record<string, string | number | null>, key: string): string {
    const v = item[key];
    return v === null || v === undefined || v === '' ? '\u2014' : String(v);
  }

  noteBadgeConfidence(noteId: string): number | null {
    return this.checkResultsByNote()[noteId]?.complianceConfidence ?? null;
  }

  noteCheckFailed(noteId: string): boolean {
    return this.checkFailedNoteIds().has(noteId);
  }

  goToVariance() {
    this.router.navigate(['/variance']);
  }
}