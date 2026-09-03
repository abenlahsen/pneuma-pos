import { Subject } from 'rxjs';
import { of } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let comp: NavbarComponent;
  let mockAuthService: { user: () => any; hasPermission: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };
  let mockSettingsService: { getCompanySettings: ReturnType<typeof vi.fn> };
  let routerEvents: Subject<any>;
  let mockRouter: { url: string; events: Subject<any> };

  function createComponent(initialUrl = '/dashboard'): NavbarComponent {
    routerEvents = new Subject();
    mockRouter = { url: initialUrl, events: routerEvents };
    return new NavbarComponent(mockAuthService as any, mockSettingsService as any, mockRouter as any);
  }

  beforeEach(() => {
    mockAuthService = {
      user: () => ({ name: 'Test User', roles: [{ name: 'Administrator' }] }),
      hasPermission: vi.fn().mockReturnValue(true),
      logout: vi.fn(),
    };
    mockSettingsService = {
      getCompanySettings: vi.fn().mockReturnValue(of({ menu_layout: 'vertical', logo_url: null })),
    };
  });

  describe('toggleGroup', () => {
    it('opens a closed group and closes it again on a second toggle', () => {
      comp = createComponent();
      const item = { label: '🏦 Finance', children: [] };
      const event = { preventDefault: vi.fn() } as unknown as Event;

      comp.toggleGroup(item, event);
      expect(comp.isGroupExpanded(item)).toBe(true);

      comp.toggleGroup(item, event);
      expect(comp.isGroupExpanded(item)).toBe(false);
    });

    it('leaves other groups untouched when toggling one (additive accordion)', () => {
      comp = createComponent();
      const finance = { label: '🏦 Finance', children: [] };
      const tiers = { label: '🤝 Tiers', children: [] };
      const event = { preventDefault: vi.fn() } as unknown as Event;

      comp.toggleGroup(finance, event);
      comp.toggleGroup(tiers, event);

      expect(comp.isGroupExpanded(finance)).toBe(true);
      expect(comp.isGroupExpanded(tiers)).toBe(true);
    });
  });

  describe('auto-expand on route', () => {
    it('expands the group containing the initial route on construction', () => {
      comp = createComponent('/primes');

      const finance = comp.allNavItems.find((i) => i.label === '🏦 Finance')!;
      expect(comp.isGroupExpanded(finance)).toBe(true);
    });

    it('does not expand any group when the initial route has no group (e.g. dashboard)', () => {
      comp = createComponent('/dashboard');

      const anyExpanded = comp.allNavItems.some((i) => i.children && comp.isGroupExpanded(i));
      expect(anyExpanded).toBe(false);
    });

    it('expands the newly active group on navigation without collapsing a manually-opened one', () => {
      comp = createComponent('/dashboard');
      const tiers = comp.allNavItems.find((i) => i.label === '🤝 Tiers')!;
      const finance = comp.allNavItems.find((i) => i.label === '🏦 Finance')!;
      comp.toggleGroup(tiers, { preventDefault: vi.fn() } as unknown as Event);

      mockRouter.url = '/primes';
      routerEvents.next(new NavigationEnd(1, '/primes', '/primes'));

      expect(comp.isGroupExpanded(finance)).toBe(true);
      expect(comp.isGroupExpanded(tiers)).toBe(true);
    });
  });

  describe('visibleNavItems', () => {
    it('hides a group entirely when none of its children pass permission checks', () => {
      mockAuthService.hasPermission.mockImplementation((perm: string) => perm !== 'view accounts' && perm !== 'view primes' && perm !== 'view hr-charges' && perm !== 'view reporting');
      comp = createComponent();

      const labels = comp.visibleNavItems().map((i) => i.label);
      expect(labels).not.toContain('🏦 Finance');
    });

    it('keeps a group with only some children filtered out, showing just the visible ones', () => {
      mockAuthService.hasPermission.mockImplementation((perm: string) => perm !== 'view primes');
      comp = createComponent();

      const finance = comp.visibleNavItems().find((i) => i.label === '🏦 Finance');
      expect(finance).toBeTruthy();
      expect(finance!.children!.map((c) => c.label)).not.toContain('🎯 Primes');
      expect(finance!.children!.map((c) => c.label)).toContain('🏦 Comptes');
    });
  });
});
