import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { getInitials } from '../utils/initials';
import { deleteCookie, getCookie, setCookie } from '../utils/cookies';

/** Cookie name + lifetime for the mocked FE-only session (no backend auth yet). */
const AUTH_COOKIE_NAME = 'afsa_auth_user';
const AUTH_COOKIE_DAYS = 7;

/**
 * MOCK USER DIRECTORY
 * -------------------
 * Stand-in for what would normally be returned by GET {apiUrl}/auth/me
 * once a real backend/identity provider is wired up. Keyed by the demo
 * account chosen on the login screen (not by role — a role can now have
 * more than one demo account) so the "logged in" user reflects the exact
 * account picked, the same way a real session would.
 */
const MOCK_USERS: Record<string, User> = {
  usr_2001: {
    id: 'usr_2001',
    name: 'FC&RD Analyst',
    email: 'analyst@aramco.com',
    role: 'finance-analyst',
    roleLabel: 'Finance Analyst',
    title: 'Analyst',
    initials: 'NC',
  }
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Currently authenticated user, exposed as a readonly signal for templates. */
  private readonly currentUserSignal = signal<User | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly isAuthenticated = () => this.currentUserSignal() !== null;

  /**
   * On construction (i.e. on every page load/reload), check for a saved
   * mock session cookie and restore the "logged in" user from it, so a
   * reload doesn't bounce the user back to /login. Swap this for a real
   * GET {apiUrl}/auth/me call once a backend session exists.
   */
  constructor() {
    const savedUserId = getCookie(AUTH_COOKIE_NAME);
    const savedUser = savedUserId ? MOCK_USERS[savedUserId] : undefined;
    if (savedUser) {
      this.currentUserSignal.set({ ...savedUser, initials: getInitials(savedUser.name) });
    }
  }

  /**
   * Simulates calling the backend to authenticate a specific demo account
   * and fetch its profile (id, name, email, role). Swap the `of(...)` body
   * for an HttpClient call to `${environment.apiUrl}/auth/login` when a
   * real backend is available — the calling components won't need to change.
   */
  login(accountId: string): Observable<User> {
    const user = { ...MOCK_USERS[accountId], initials: getInitials(MOCK_USERS[accountId].name) };
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
    setCookie(AUTH_COOKIE_NAME, user.id, AUTH_COOKIE_DAYS);
  }

  logout(): void {
    this.currentUserSignal.set(null);
    deleteCookie(AUTH_COOKIE_NAME);
  }
}