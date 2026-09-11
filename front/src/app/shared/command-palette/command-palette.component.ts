import { Component, ElementRef, HostListener, ViewChild, computed, effect, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { SaleService } from '../../core/services/sale.service';
import { ProductService } from '../../core/services/product.service';
import { IconComponent } from '../icon/icon.component';
import { NAV_ITEMS, RailItem } from '../rail/nav-items';

interface DestinationResult {
  kind: 'destination';
  icon: string;
  label: string;
  route: string;
}

interface SaleResult {
  kind: 'sale';
  id: number;
  reference: string | null;
  client: string;
  totalSale: string | null;
}

interface ProductResult {
  kind: 'product';
  id: number;
  profile: string | null;
  reference: string | null;
  brandName: string | null;
}

type PaletteResult = DestinationResult | SaleResult | ProductResult;

const MIN_QUERY_LENGTH = 2;
const API_RESULTS_LIMIT = '5';

/**
 * Palette `Ctrl/⌘ K` — composant autonome (aucune dépendance sur RailComponent,
 * seulement sur la même liste de données `NAV_ITEMS`). Monté une fois dans
 * `app.html`, à côté de `<app-rail />`.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss',
})
export class CommandPaletteComponent {
  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(0);
  readonly loading = signal(false);

  private readonly saleResults = signal<SaleResult[]>([]);
  private readonly productResults = signal<ProductResult[]>([]);
  private readonly query$ = new Subject<string>();

  @ViewChild('paletteInput') private readonly inputRef?: ElementRef<HTMLInputElement>;

  /** Destinations aplaties, filtrées par permission — même règle que RailComponent.items(). */
  private readonly flatDestinations = computed<DestinationResult[]>(() => {
    const flat: DestinationResult[] = [];
    const visit = (items: RailItem[]): void => {
      for (const item of items) {
        if (item.children) {
          visit(item.children);
          continue;
        }
        if (item.route && (!item.permission || this.authService.hasPermission(item.permission))) {
          flat.push({ kind: 'destination', icon: item.icon, label: item.label, route: item.route });
        }
      }
    };
    visit(NAV_ITEMS);
    return flat;
  });

  private readonly filteredDestinations = computed<DestinationResult[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.flatDestinations();
    return q ? all.filter((d) => d.label.toLowerCase().includes(q)) : all;
  });

  /** Une seule liste, dans l'ordre : destinations · ventes · produits. */
  readonly results = computed<PaletteResult[]>(() => [
    ...this.filteredDestinations(),
    ...this.saleResults(),
    ...this.productResults(),
  ]);

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly saleService: SaleService,
    private readonly productService: ProductService,
  ) {
    this.query$.pipe(debounceTime(250), distinctUntilChanged()).subscribe((q) => this.search(q));

    // L'index actif retombe sur le premier résultat à chaque nouvelle recherche —
    // sinon il pourrait pointer au-delà de la nouvelle liste, plus courte.
    effect(() => {
      this.results();
      this.activeIndex.set(0);
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.toggle();
      return;
    }

    if (!this.open()) {
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Enter':
        event.preventDefault();
        this.selectActive();
        break;
    }
  }

  toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.openPalette();
    }
  }

  openPalette(): void {
    this.open.set(true);
    queueMicrotask(() => this.inputRef?.nativeElement.focus());
  }

  close(): void {
    this.open.set(false);
    this.query.set('');
    this.query$.next('');
    this.saleResults.set([]);
    this.productResults.set([]);
    this.loading.set(false);
  }

  onQueryInput(value: string): void {
    this.query.set(value);
    this.query$.next(value);
  }

  select(item: PaletteResult): void {
    switch (item.kind) {
      case 'destination':
        this.router.navigateByUrl(item.route);
        break;
      case 'sale':
        this.router.navigate(['/sales'], { queryParams: { id: item.id } });
        break;
      case 'product':
        this.router.navigate(['/products'], { queryParams: { id: item.id } });
        break;
    }
    this.close();
  }

  selectActive(): void {
    const item = this.results()[this.activeIndex()];
    if (item) {
      this.select(item);
    }
  }

  private move(delta: number): void {
    const len = this.results().length;
    if (!len) {
      return;
    }
    this.activeIndex.update((i) => (i + delta + len) % len);
  }

  private search(rawQuery: string): void {
    const query = rawQuery.trim();

    if (query.length < MIN_QUERY_LENGTH) {
      this.saleResults.set([]);
      this.productResults.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    forkJoin({
      sales: this.authService.hasPermission('view sales')
        ? this.saleService.getSales({ search: query, per_page: API_RESULTS_LIMIT }).pipe(catchError(() => of(null)))
        : of(null),
      products: this.authService.hasPermission('view products')
        ? this.productService.getProducts({ search: query, per_page: API_RESULTS_LIMIT }).pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe(({ sales, products }) => {
      this.saleResults.set(
        (sales?.data ?? []).map((s) => ({
          kind: 'sale' as const,
          id: s.id,
          reference: (s as { reference?: string | null }).reference ?? null,
          client: s.client,
          totalSale: s.total_sale != null ? String(s.total_sale) : null,
        })),
      );
      this.productResults.set(
        (products?.data ?? []).map((p) => ({
          kind: 'product' as const,
          id: p.id,
          profile: p.profile,
          reference: p.reference,
          brandName: p.brand?.name ?? null,
        })),
      );
      this.loading.set(false);
    });
  }
}
