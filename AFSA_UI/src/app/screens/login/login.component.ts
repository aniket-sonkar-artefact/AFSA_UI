import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon';
import { LogoBadgeComponent } from '../../shared/logo-badge/logo-badge';
import { TeamProfileService } from '../../core/services/team-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { TeamProfile } from '../../core/models/team-profile.model';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, IconComponent, LogoBadgeComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  readonly profiles = signal<TeamProfile[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly submitting = signal(false);

  /** Drives the two-stage rail animation: collapsed strip <-> expanded login panel. */
  readonly expanded = signal(false);

  constructor(
    private readonly teamProfileService: TeamProfileService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.teamProfileService.getTeamProfiles().subscribe((profiles) => this.profiles.set(profiles));
  }

  get selectedProfile(): TeamProfile | undefined {
    return this.profiles().find((p) => p.id === this.selectedId());
  }

  onRailEnter(): void {
    this.expanded.set(true);
  }

  onRailLeave(): void {
    this.expanded.set(false);
  }

  onRailClick(): void {
    if (!this.expanded()) {
      this.expanded.set(true);
    }
  }

  select(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedId.set(id);
  }

  continue(event: MouseEvent): void {
    event.stopPropagation();
    const profile = this.selectedProfile;
    if (!profile || this.submitting()) return;

    this.submitting.set(true);
    this.authService.login(profile.id as UserRole).subscribe((user) => {
      this.authService.setCurrentUser(user);
      this.submitting.set(false);
      this.router.navigate(['/overview']);
    });
  }
}
