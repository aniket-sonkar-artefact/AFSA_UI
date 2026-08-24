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
  selectionBackground: string;
  glow: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/overview',
    label: 'Overview',
    icon: 'home',
    accent: '#00A3E0',
    selectionBackground: 'linear-gradient(135deg, #84BD00 0%, #00A3E0 100%)',
    glow: 'rgba(0, 163, 224, 0.22)',
  },
  {
    path: '/submission',
    label: 'Affiliate Submission Review',
    icon: 'file-text',
    accent: '#1F497D',
    selectionBackground: '#1F497D',
    glow: 'rgba(31, 73, 125, 0.22)',
  },
  {
    path: '/ifrs',
    label: 'Compliance Monitoring & Benchmarking',
    icon: 'check-circle',
    accent: '#C0504D',
    selectionBackground: '#C0504D',
    glow: 'rgba(192, 80, 77, 0.22)',
  },
  {
    path: '/variance',
    label: 'Management Reports & Variance Analysis',
    icon: 'bar-chart',
    accent: '#8064A2',
    selectionBackground: '#8064A2',
    glow: 'rgba(128, 100, 162, 0.24)',
  },
  {
    path: '/integrity',
    label: 'Financial Statement Integrity Check',
    icon: 'shield',
    accent: '#4BACC6',
    selectionBackground: '#4BACC6',
    glow: 'rgba(75, 172, 198, 0.24)',
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: 'archive',
    accent: '#64748B',
    selectionBackground: '#64748B',
    glow: 'rgba(100, 116, 139, 0.20)',
  },
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
  readonly loggingOut = signal(false);

  readonly sidebarWidth = computed(() => (this.collapsed() ? 64 : 232));
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
    if (this.loggingOut()) return;
    this.loggingOut.set(true);

    setTimeout(() => {
      this.auth.logout();
      this.router.navigate(['/login']);
    }, 360);
  }
}
