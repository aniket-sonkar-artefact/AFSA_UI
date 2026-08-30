import { Injectable, computed, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, inject } from '@angular/core';

/**
 * SINGLE SOURCE OF TRUTH for breakpoint pixel values on the TypeScript side.
 * MUST stay in sync with src/styles/_breakpoints.scss ($bp-* variables).
 * These are viewport-range based, not device-name based: there's no reliable
 * cross-browser way to ask "is this a tablet". Screen width + pointer type
 * (touch vs mouse) is the only honest signal, so that's what we key off.
 */
export const BREAKPOINTS = {
  handset: '(max-width: 599px)',
  tabletPortrait: '(min-width: 600px) and (max-width: 899px)',
  tabletLandscape: '(min-width: 900px) and (max-width: 1279px)',
  tablet: '(min-width: 600px) and (max-width: 1279px)',
  tabletDown: '(max-width: 1279px)',
  desktopUp: '(min-width: 1280px)',
  coarsePointer: '(pointer: coarse)',
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
} as const;

/**
 * Shared reactive breakpoint/device-shape service.
 *
 * Usage in a component:
 *   private responsive = inject(ResponsiveService);
 *   isTablet = this.responsive.isTablet; // signal<boolean>
 *
 * Usage in a template:
 *   @if (responsive.isTablet()) { ... }
 *
 * Do NOT use window.innerWidth / manual pixel checks anywhere else in the app —
 * route all "what size/shape is the viewport" logic through this service so
 * there is exactly one place that defines what "tablet" means.
 */
@Injectable({ providedIn: 'root' })
export class ResponsiveService {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);

  // Raw signals updated from BreakpointObserver streams
  private readonly _isHandset = signal(false);
  private readonly _isTabletPortrait = signal(false);
  private readonly _isTabletLandscape = signal(false);
  private readonly _isTouch = signal(false);
  private readonly _isPortrait = signal(false);

  /** True for phone-sized viewports (< 600px) */
  readonly isHandset = this._isHandset.asReadonly();

  /** True for tablet portrait viewports (600px–899px) */
  readonly isTabletPortrait = this._isTabletPortrait.asReadonly();

  /** True for tablet landscape viewports (900px–1279px) */
  readonly isTabletLandscape = this._isTabletLandscape.asReadonly();

  /** True for the full tablet range, either orientation (600px–1279px) */
  readonly isTablet = computed(() => this._isTabletPortrait() || this._isTabletLandscape());

  /** True for tablet OR handset (i.e. "not desktop") — use to trigger compact/off-canvas layouts */
  readonly isTabletDown = computed(() => this.isHandset() || this.isTablet());

  /** True when the primary input is a coarse pointer (touch), regardless of screen size */
  readonly isTouch = this._isTouch.asReadonly();

  /** True when the viewport is currently in portrait orientation */
  readonly isPortrait = this._isPortrait.asReadonly();

  constructor() {
    this.breakpointObserver
      .observe([BREAKPOINTS.handset])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => this._isHandset.set(state.matches));

    this.breakpointObserver
      .observe([BREAKPOINTS.tabletPortrait])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => this._isTabletPortrait.set(state.matches));

    this.breakpointObserver
      .observe([BREAKPOINTS.tabletLandscape])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => this._isTabletLandscape.set(state.matches));

    this.breakpointObserver
      .observe([BREAKPOINTS.coarsePointer])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => this._isTouch.set(state.matches));

    this.breakpointObserver
      .observe([BREAKPOINTS.portrait])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => this._isPortrait.set(state.matches));
  }
}
