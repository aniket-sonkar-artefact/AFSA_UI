import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { TeamProfile } from '../models/team-profile.model';
import { DemoAccount } from '../models/demo-account.model';
import { getInitials } from '../utils/initials';

const ROLE_PROFILES: TeamProfile[] = [
  {
    id: 'finance-analyst',
    name: 'Finance Analyst',
    desc: 'Prepares consolidation entries, reviews affiliate submissions and supports variance analysis.',
    initials: 'FA',
    color: '#35e0b5',
  },
  {
    id: 'finance-manager',
    name: 'Finance Manager',
    desc: 'Oversees IFRS compliance, approves consolidation outputs and manages review sign-off.',
    initials: 'FM',
    color: '#35e0b5',
  },
  {
    id: 'finance-user',
    name: 'Finance User',
    desc: 'General finance team access for submission tracking and reporting visibility.',
    initials: 'FU',
    color: '#35e0b5',
  },
];

/**
 * MOCK DEMO ACCOUNT DIRECTORY
 *
 * All demo accounts are kept here. The previous two-step login
 * filtered these accounts by role. The new login screen displays
 * all accounts directly.
 */
const ACCOUNTS_BY_ROLE: Record<string, DemoAccount[]> = {
  'finance-analyst': [
    {
      id: 'usr_2001',
      name: 'Lynn Mansour',
      email: 'FC&RD.Analyst@aramco.com',
      tierLabel: 'FC&RD Analyst',
      roleId: 'finance-analyst',
      initials: 'FC&RD',
    }
  ],
};

@Injectable({
  providedIn: 'root',
})
export class TeamProfileService {

  getTeamProfiles(): Observable<TeamProfile[]> {
    return of(ROLE_PROFILES).pipe(
      delay(environment.useMockData ? 150 : 0)
    );
  }

  /**
   * Returns all demo accounts.
   *
   * Used by the new one-step login screen where the user
   * directly selects an account without selecting a role first.
   */
  getAllAccounts(): Observable<DemoAccount[]> {
    const accounts = Object.values(ACCOUNTS_BY_ROLE).flat();

    return of(accounts).pipe(
      delay(environment.useMockData ? 150 : 0)
    );
  }

  /**
   * Kept for backward compatibility.
   *
   * Can still be used by any other screen/service that needs
   * accounts belonging to a specific role.
   */
  getAccountsForRole(roleId: string): Observable<DemoAccount[]> {
    return of(ACCOUNTS_BY_ROLE[roleId] ?? []).pipe(
      delay(environment.useMockData ? 150 : 0)
    );
  }
}
