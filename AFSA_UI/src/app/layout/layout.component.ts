import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent, IconName } from '../shared/icon/icon';
import { LogoBadgeComponent } from '../shared/logo-badge/logo-badge';
import { AuthService } from '../core/services/auth.service';
import { ResponsiveService } from '../core/services/responsive.service';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  accent: string;
  selectionBackground: string;
  glow: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/home',
    label: 'Home',
    icon: 'home',
    accent: '#00A3E0',
    selectionBackground: 'linear-gradient(135deg, #84BD00 0%, #00A3E0 100%)',
    glow: 'rgba(0, 163, 224, 0.22)',
  },
  {
    path: '/submission',
    label: 'Affiliate Submission Reviewer',
    icon: 'file-text',
    accent: '#1F497D',
    selectionBackground: '#1F497D',
    glow: 'rgba(31, 73, 125, 0.22)',
  },
  {
    // Not yet built -- shown greyed out / unclickable to match the approved
    // sidebar, which previews the full future workspace roadmap.
    path: '',
    label: 'Preliminary Results Solution',
    icon: 'trending-up',
    accent: '#64748B',
    selectionBackground: '#64748B',
    glow: 'rgba(100, 116, 139, 0.2)',
    disabled: true,
  },
  {
    path: '',
    label: 'Intercompany Elimination & Reconciliation',
    icon: 'layers',
    accent: '#64748B',
    selectionBackground: '#64748B',
    glow: 'rgba(100, 116, 139, 0.2)',
    disabled: true,
  },
  {
    path: '',
    label: 'Cash Flow Statement Analysis & Review',
    icon: 'dollar',
    accent: '#64748B',
    selectionBackground: '#64748B',
    glow: 'rgba(100, 116, 139, 0.2)',
    disabled: true,
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
    path: '/mgmtreport',
    label: 'Management Report Generator',
    icon: 'bar-chart',
    accent: '#8064A2',
    selectionBackground: '#8064A2',
    glow: 'rgba(128, 100, 162, 0.24)',
  },
  {
    path: '/integrity',
    label: 'Financial Statement Integrity and Formatting',
    icon: 'shield',
    accent: '#4BACC6',
    selectionBackground: '#4BACC6',
    glow: 'rgba(75, 172, 198, 0.24)',
  },
  {
    path: '',
    label: 'FS Translation & Terminology Management',
    icon: 'translate',
    accent: '#64748B',
    selectionBackground: '#64748B',
    glow: 'rgba(100, 116, 139, 0.2)',
    disabled: true,
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
  private readonly responsive = inject(ResponsiveService);

  readonly navItems = NAV_ITEMS;
  readonly collapsed = signal(false);
  readonly darkMode = signal<boolean>(this.readStoredTheme());
  readonly loggingOut = signal(false);

  /** Off-canvas drawer sidebar: handset + tablet-portrait (too narrow for a permanent rail) */
  readonly isDrawerMode = computed(() => this.responsive.isHandset() || this.responsive.isTabletPortrait());
  /** Tablet-landscape: keep the permanent rail, but default it to the icon-only collapsed state */
  readonly isCompactPush = computed(() => this.responsive.isTabletLandscape());
  readonly drawerOpen = signal(false);
  readonly drawerWidth = 260;

  /** 0 when the sidebar overlays instead of pushing content (drawer mode) */
  readonly sidebarWidth = computed(() => (this.isDrawerMode() ? 0 : this.collapsed() ? 64 : 232));
  /** The drawer is always full-width/labelled, so labels show whenever expanded or in drawer mode */
  readonly showLabels = computed(() => this.isDrawerMode() || !this.collapsed());
  readonly currentUser;

  /** Set once the user manually toggles the rail, so we stop overriding their choice */
  private userToggledCollapse = false;

  constructor(private readonly auth: AuthService, private readonly router: Router) {
    this.currentUser = this.auth.currentUser;
    this.applyTheme(this.darkMode());

    // Auto-collapse the pushed sidebar on tablet-landscape, auto-expand back on desktop,
    // unless the person has already told us what they want via the manual toggle.
    effect(() => {
      const compact = this.isCompactPush();
      const drawer = this.isDrawerMode();
      if (this.userToggledCollapse || drawer) return;
      this.collapsed.set(compact);
    });

    // If the viewport grows out of drawer range while the drawer happens to be open, close it.
    effect(() => {
      if (!this.isDrawerMode() && this.drawerOpen()) {
        this.drawerOpen.set(false);
      }
    });
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
    this.userToggledCollapse = true;
    this.collapsed.update((c) => !c);
  }

  toggleDrawer() {
    this.drawerOpen.update((o) => !o);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
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
