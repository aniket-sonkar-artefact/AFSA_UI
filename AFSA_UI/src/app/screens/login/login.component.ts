import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LogoBadgeComponent } from '../../shared/logo-badge/logo-badge';
import { TeamProfileService } from '../../core/services/team-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { TeamProfile } from '../../core/models/team-profile.model';
import { UserRole } from '../../core/models/user.model';

interface FeatureHighlight {
  icon: string;
  accent: string;
  title: string;
  desc: string;
}

const FEATURES: FeatureHighlight[] = [
  { icon: '\u25C8', accent: '#84BD00', title: 'Affiliate Submission Review', desc: 'Completeness, irregularities, and CoA mapping reviewed automatically.' },
  { icon: '\u2B21', accent: '#00A3E0', title: 'Compliance Monitoring', desc: 'On-demand IFRS compliance assessment across prioritised requirements.' },
  { icon: '\u2696', accent: '#84BD00', title: 'Variance Analysis', desc: 'Group-level variance analysis with structured management reporting.' },
  { icon: '\u2713', accent: '#00A3E0', title: 'Integrity Checks', desc: 'Automated footing and cross-reference validation across all statements.' },
];

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LogoBadgeComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  readonly features = FEATURES;
  readonly profiles = signal<TeamProfile[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly submitting = signal(false);

  constructor(
    private readonly teamProfileService: TeamProfileService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.teamProfileService.getTeamProfiles().subscribe((profiles) => this.profiles.set(profiles));
  }

  select(id: string) {
    this.selectedId.set(id);
  }

  continue() {
    const id = this.selectedId();
    if (!id || this.submitting()) return;

    this.submitting.set(true);
    this.authService.login(id as UserRole).subscribe((user) => {
      this.authService.setCurrentUser(user);
      this.submitting.set(false);
      this.router.navigate(['/overview']);
    });
  }
}
