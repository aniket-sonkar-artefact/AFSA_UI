import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { User, UserRole } from '../models/user.model';
import { getInitials } from '../utils/initials';

/**
 * MOCK USER DIRECTORY
 * -------------------
 * Stand-in for what would normally be returned by GET {apiUrl}/auth/me
 * once a real backend/identity provider is wired up. Keyed by the team
 * profile chosen on the login screen so the "logged in" user reflects
 * the selection, the same way a real session would.
 */
const MOCK_USERS: Record<UserRole, User> = {
  consolidation: {
    id: 'usr_1001',
    name: 'Aniket Sonkar',
    email: 'mohammed.k@afsa-platform.com',
    role: 'consolidation',
    roleLabel: 'Financial Controller',
    initials: 'MK',
  },
  reporting: {
    id: 'usr_1002',
    name: 'Aniket Sonkar',
    email: 'mohammed.k@afsa-platform.com',
    role: 'reporting',
    roleLabel: 'Financial Reporting Group (FRG)',
    initials: 'MK',
  },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Currently authenticated user, exposed as a readonly signal for templates. */
  private readonly currentUserSignal = signal<User | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly isAuthenticated = () => this.currentUserSignal() !== null;

  /**
   * Simulates calling the backend to authenticate/select a team and fetch
   * the user's profile (id, name, email, role). Swap the `of(...)` body
   * for an HttpClient call to `${environment.apiUrl}/auth/login` when a
   * real backend is available — the calling components won't need to change.
   */
  login(role: UserRole): Observable<User> {
    const user = { ...MOCK_USERS[role], initials: getInitials(MOCK_USERS[role].name) };
    return of(user).pipe(delay(environment.useMockData ? 250 : 0));
  }

  /**
   * Simulates GET {apiUrl}/auth/me — fetching the current session's user
   * info. Components should call this rather than reading state directly,
   * matching how a real API-backed app would fetch/refresh user info.
   */
  getCurrentUser(): Observable<User | null> {
    return of(this.currentUserSignal()).pipe(delay(environment.useMockData ? 150 : 0));
  }

  setCurrentUser(user: User): void {
    this.currentUserSignal.set(user);
  }

  logout(): void {
    this.currentUserSignal.set(null);
  }
}
