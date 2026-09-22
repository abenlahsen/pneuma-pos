import { Subject } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { RailComponent } from './rail.component';

describe('RailComponent', () => {
  let comp: RailComponent;
  let mockAuthService: { hasPermission: ReturnType<typeof vi.fn> };
  let routerEvents: Subject<any>;
  let mockRouter: { url: string; events: Subject<any> };
  let mockElementRef: { nativeElement: HTMLElement };
  /** Refonte 2b, 8a : le rail lit l'état du volet, qu'il partage avec la barre haute. */
  let mockShellNav: { panelOpen: () => boolean; close: ReturnType<typeof vi.fn> };

  function createComponent(initialUrl = '/dashboard'): RailComponent {
    routerEvents = new Subject();
    mockRouter = { url: initialUrl, events: routerEvents };
    mockElementRef = { nativeElement: document.createElement('div') };
    return new RailComponent(mockAuthService as any, mockRouter as any, mockElementRef as any, mockShellNav as any);
  }

  /** toggleGroup reads `event.currentTarget.getBoundingClientRect()` to position the flyout. */
  function clickEvent(): Event {
    const button = document.createElement('button');
    return { preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: button } as unknown as Event;
  }

  beforeEach(() => {
    mockAuthService = { hasPermission: vi.fn().mockReturnValue(true) };
    mockShellNav = { panelOpen: () => false, close: vi.fn() };
  });

  describe('toggleGroup', () => {
    it('opens a closed group and closes it again on a second toggle', () => {
      comp = createComponent();
      const finance = comp.allNavItems.find((i) => i.label === 'Finance')!;
      const event = clickEvent();

      comp.toggleGroup(finance, event);
      expect(comp.isGroupOpen(finance)).toBe(true);

      comp.toggleGroup(finance, event);
      expect(comp.isGroupOpen(finance)).toBe(false);
    });

    it('opening a different group closes the previous one — one flyout at a time, unlike the old accordion', () => {
      comp = createComponent();
      const finance = comp.allNavItems.find((i) => i.label === 'Finance')!;
      const tiers = comp.allNavItems.find((i) => i.label === 'Tiers')!;
      const event = clickEvent();

      comp.toggleGroup(finance, event);
      comp.toggleGroup(tiers, event);

      expect(comp.isGroupOpen(finance)).toBe(false);
      expect(comp.isGroupOpen(tiers)).toBe(true);
    });
  });

  describe('navigation', () => {
    it('closes the open flyout on route change', () => {
      comp = createComponent();
      const finance = comp.allNavItems.find((i) => i.label === 'Finance')!;
      comp.toggleGroup(finance, clickEvent());
      expect(comp.isGroupOpen(finance)).toBe(true);

      routerEvents.next(new NavigationEnd(1, '/primes', '/primes'));

      expect(comp.isGroupOpen(finance)).toBe(false);
    });
  });

  describe('isGroupActive', () => {
    it('is true when the current route matches one of the group children', () => {
      comp = createComponent('/primes');
      const finance = comp.allNavItems.find((i) => i.label === 'Finance')!;
      expect(comp.isGroupActive(finance)).toBe(true);
    });

    it('is false when the current route matches no child', () => {
      comp = createComponent('/dashboard');
      const finance = comp.allNavItems.find((i) => i.label === 'Finance')!;
      expect(comp.isGroupActive(finance)).toBe(false);
    });
  });

  describe('visibleNavItems', () => {
    it('hides a group entirely when none of its children pass permission checks', () => {
      mockAuthService.hasPermission.mockImplementation(
        (perm: string) => perm !== 'view accounts' && perm !== 'view primes' && perm !== 'view hr-charges' && perm !== 'view reporting',
      );
      comp = createComponent();

      const labels = comp.visibleNavItems().map((i) => i.label);
      expect(labels).not.toContain('Finance');
    });

    it('keeps a group with only some children filtered out, showing just the visible ones', () => {
      mockAuthService.hasPermission.mockImplementation((perm: string) => perm !== 'view primes');
      comp = createComponent();

      const finance = comp.visibleNavItems().find((i) => i.label === 'Finance');
      expect(finance).toBeTruthy();
      expect(finance!.children!.map((c) => c.label)).not.toContain('Primes');
      expect(finance!.children!.map((c) => c.label)).toContain('Comptes');
    });
  });
});
