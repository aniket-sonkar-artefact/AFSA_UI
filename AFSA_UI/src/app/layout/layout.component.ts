import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent, IconName } from '../shared/icon/icon';
import { LogoBadgeComponent } from '../shared/logo-badge/logo-badge';
import { AuthService } from '../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  accent: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/overview', label: 'Overview', icon: 'home', accent: '#0033A0' },
  { path: '/submission', label: 'Affiliate Submission Review', icon: 'file-text', accent: '#84BD00' },
  { path: '/ifrs', label: 'Compliance Monitoring & Benchmarking', icon: 'check-circle', accent: '#0033A0' },
  { path: '/variance', label: 'Management Reports & Variance Analysis', icon: 'bar-chart', accent: '#00A3E0' },
  { path: '/integrity', label: 'Financial Statement Integrity Check', icon: 'shield', accent: '#00843D' },
  { path: '/reports', label: 'Reports', icon: 'archive', accent: '#475569' },
  { path: '/settings', label: 'Settings', icon: 'settings', accent: '#94A3B8', disabled: true },
];

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, IconComponent, LogoBadgeComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  readonly navItems = NAV_ITEMS;
  readonly collapsed = signal(false);
  readonly darkMode = signal<boolean>(this.readStoredTheme());

  readonly sidebarWidth = computed(() => (this.collapsed() ? 64 : 220));
  readonly currentUser;

  constructor(private readonly auth: AuthService, private readonly router: Router) {
    this.currentUser = this.auth.currentUser;
    this.applyTheme(this.darkMode());
  }

  private readStoredTheme(): boolean {
    try {
      return localStorage.getItem('afsa-theme') === 'dark';
    } catch {
      return false;
    }
  }

  private applyTheme(isDark: boolean) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try {
      localStorage.setItem('afsa-theme', isDark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }

  toggleCollapsed() {
    this.collapsed.update((c) => !c);
  }

  toggleDarkMode() {
    this.darkMode.update((d) => {
      const next = !d;
      this.applyTheme(next);
      return next;
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
