import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComplianceService } from '../../core/services/compliance.service';
import { CheckState, IfrsNote, NoteCheckResult } from '../../core/models/compliance.model';

@Component({
  selector: 'app-compliance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './compliance.component.html',
  styleUrl: './compliance.component.scss',
})
export class ComplianceComponent implements OnInit {
  readonly notes = signal<IfrsNote[]>([]);
  readonly selectedNoteId = signal(0);
  readonly narratives = signal<Record<number, string>>({});
  readonly checkStates = signal<Record<number, CheckState>>({});
  readonly checkRuns = signal<Record<number, number>>({});
  readonly noteResults = signal<Record<number, NoteCheckResult>>({});
  readonly reportToast = signal(false);

  readonly note = computed(() => this.notes().find((n) => n.id === this.selectedNoteId()));
  readonly narrative = computed(() => this.narratives()[this.selectedNoteId()] ?? this.note()?.defaultNarrative ?? '');
  readonly checkState = computed<CheckState>(() => this.checkStates()[this.selectedNoteId()] ?? 'idle');
  readonly result = computed(() => this.noteResults()[this.selectedNoteId()]);

  readonly confidenceColor = computed(() => {
    const r = this.result();
    if (!r) return '#0033A0';
    return r.confidence >= 85 ? '#00843D' : r.confidence >= 70 ? '#F59E0B' : '#DC2626';
  });

  constructor(private readonly complianceService: ComplianceService) {}

  ngOnInit(): void {
    this.complianceService.getNotes().subscribe((notes) => this.notes.set(notes));
  }

  selectNote(id: number) {
    this.selectedNoteId.set(id);
  }

  noteRunResult(noteId: number) {
    return this.noteResults()[noteId];
  }

  standardShort(standard: string) {
    return standard.split(' \u2014 ')[0];
  }

  onNarrativeChange(value: string) {
    const id = this.selectedNoteId();
    this.narratives.update((prev) => ({ ...prev, [id]: value }));
    this.checkStates.update((prev) => ({ ...prev, [id]: 'idle' }));
  }

  runCheck() {
    const id = this.selectedNoteId();
    const runCount = this.checkRuns()[id] ?? 0;
    this.checkStates.update((prev) => ({ ...prev, [id]: 'checking' }));

    this.complianceService.runComplianceCheck(id, this.narrative(), runCount).subscribe((result) => {
      this.checkStates.update((prev) => ({ ...prev, [id]: 'done' }));
      this.checkRuns.update((prev) => ({ ...prev, [id]: runCount + 1 }));
      this.noteResults.update((prev) => ({ ...prev, [id]: result }));
    });
  }

  showReportToast() {
    this.reportToast.set(true);
    setTimeout(() => this.reportToast.set(false), 3000);
  }
}
