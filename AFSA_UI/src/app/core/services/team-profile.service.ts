import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TeamProfile } from '../models/team-profile.model';

const MOCK_PROFILES: TeamProfile[] = [
  {
    id: 'consolidation',
    name: 'Financial Controller',
    desc: 'Trial balance consolidation, affiliate submission review, and financial statement preparation.',
    initials: 'FC&AG',
    color: '#84BD00',
  },
  {
    id: 'reporting',
    name: 'Financial Reporting Group (FRG)',
    desc: 'IFRS compliance monitoring, variance analysis, and management reporting.',
    initials: 'FRG',
    color: '#00A3E0',
  },
];

@Injectable({ providedIn: 'root' })
export class TeamProfileService {
  /** Simulates GET {apiUrl}/teams */
  getTeamProfiles(): Observable<TeamProfile[]> {
    return of(MOCK_PROFILES).pipe(delay(environment.useMockData ? 200 : 0));
  }
}
