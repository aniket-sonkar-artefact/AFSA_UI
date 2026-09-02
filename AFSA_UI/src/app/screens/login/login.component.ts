import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { IconComponent } from '../../shared/icon/icon';
import { LogoBadgeComponent } from '../../shared/logo-badge/logo-badge';
import { TeamProfileService } from '../../core/services/team-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { DemoAccount } from '../../core/models/demo-account.model';
import { ResponsiveService } from '../../core/services/responsive.service';
import { ARAMCO_LOGO_WHITE_DATA_URI } from '../../shared/aramco-logo.constant';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    LogoBadgeComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
    readonly aramcoLogoDataUri = ARAMCO_LOGO_WHITE_DATA_URI;
  private readonly responsive = inject(ResponsiveService);

  /**
   * Demo accounts are now loaded directly.
   * No role-selection step is required.
   */
  readonly accounts = signal<DemoAccount[]>([]);

  readonly selectedId = signal<string | null>(null);

  readonly submitting = signal(false);

  /**
   * Controls the desktop hover-to-expand login rail.
   */
  readonly expanded = signal(false);

  /**
   * On touch devices / tablets the login panel remains expanded.
   */
  readonly forceExpanded = () =>
    this.responsive.isTouch() ||
    this.responsive.isTabletDown();

  constructor(
    private readonly teamProfileService: TeamProfileService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    effect(() => {
      if (this.forceExpanded()) {
        this.expanded.set(true);
      }
    });
  }

  ngOnInit(): void {
    /**
     * Directly load the accounts.
     *
     * If your backend currently requires a role ID to retrieve accounts,
     * you will need either:
     *
     * 1. A new API that returns all demo accounts, or
     * 2. A default role ID to use here.
     */
    this.teamProfileService.getAllAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
      },
      error: (error) => {
        console.error('Failed to load demo accounts', error);
      },
    });
  }

  get selectedAccount(): DemoAccount | undefined {
    return this.accounts().find(
      (account) => account.id === this.selectedId()
    );
  }

  onRailEnter(): void {
    this.expanded.set(true);
  }

  onRailLeave(): void {
    if (this.forceExpanded()) {
      return;
    }

    this.expanded.set(false);
  }

  onRailClick(): void {
    if (!this.expanded()) {
      this.expanded.set(true);
    }
  }

  /**
   * Select a demo account. Clicking an already-selected account deselects it.
   */
  selectAccount(id: string, event: MouseEvent): void {
    event.stopPropagation();

    this.selectedId.update((current) => (current === id ? null : id));
  }

  /**
   * Sign in using the selected account.
   */
  continue(event: MouseEvent): void {
    event.stopPropagation();

    const account = this.selectedAccount;

    if (!account || this.submitting()) {
      return;
    }

    this.submitting.set(true);

    this.authService.login(account.id).subscribe({
      next: (user) => {
        this.authService.setCurrentUser(user);
        this.submitting.set(false);

        this.router.navigate(['/home']);
      },
      error: (error) => {
        console.error('Login failed', error);
        this.submitting.set(false);
      },
    });
  }
}