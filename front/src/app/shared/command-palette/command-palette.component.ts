import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { NAV_ITEMS, NavItem } from '../rail/nav-items';
import { ClientService } from '../../features/clients/data-access/client.service';
import { SaleService } from '../../features/sales/data-access/sale.service';
import { ServiceOrderService } from '../../features/service-orders/data-access/service-order.service';
import { StockService } from '../../features/stock/data-access/stock.service';
import { Client } from '../../features/clients/models/client.model';
import { Sale } from '../../features/sales/models/sale.model';
import { ServiceOrder } from '../../core/models/service-order.model';
import { StockGroup } from '../../features/stock/models/stock.model';
import { CommandPaletteService } from './command-palette.service';
import { PaletteGroup, PaletteResult, looseIncludes } from './command-palette.model';

/** Résultats retenus par source : au-delà, la palette devient une liste. */
const LIMIT = 5;

/** En deçà, on n'interroge pas le serveur : on montre les destinations. */
const MIN_CHARS = 2;

/**
 * Palette de commandes (⌘K) — refonte 2b.
 *
 * Remplace la zone de recherche inerte de la barre haute, qui promettait
 * « Client, dimension (2055516), n° de vente… » sans rien chercher.
 *
 * Quatre sources de données plus les destinations de navigation, chacune
 * filtrée par les permissions de l'utilisateur : on ne cherche pas dans ce
 * qu'il n'a pas le droit de consulter, et la palette n'est donc pas un moyen
 * détourné d'apprendre qu'un client existe.
 *
 * Chaque source porte son propre catchError : si les ventes tombent, les
 * clients s'affichent quand même, et l'échec est dit plutôt que tu.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss',
})
export class CommandPaletteComponent {
  private readonly palette = inject(CommandPaletteService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly clientService = inject(ClientService);
  private readonly saleService = inject(SaleService);
  private readonly serviceOrderService = inject(ServiceOrderService);
  private readonly stockService = inject(StockService);

  readonly isOpen = this.palette.isOpen;
  readonly query = signal('');
  readonly loading = signal(false);
  readonly groups = signal<PaletteGroup[]>([]);
  readonly activeIndex = signal(0);

  /** Liste à plat des résultats, dans l'ordre d'affichage : c'est elle que parcourent ↑ et ↓. */
  readonly flatResults = computed(() => this.groups().flatMap((group) => group.results));

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('queryInput');
  private readonly queryChanges = new Subject<string>();

  constructor() {
    this.queryChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        // switchMap et non mergeMap : une réponse partie avant la dernière
        // frappe ne doit jamais écraser un résultat plus récent.
        switchMap((term) => this.search(term)),
        takeUntilDestroyed(),
      )
      .subscribe((groups) => {
        this.groups.set(groups);
        this.activeIndex.set(0);
        this.loading.set(false);
      });

    effect(() => {
      if (this.isOpen()) {
        this.reset();
        // Le champ n'existe qu'une fois le @if rendu.
        setTimeout(() => this.input()?.nativeElement.focus(), 0);
      }
    });
  }

  // ── Ouverture / fermeture ──────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.toggle();
      return;
    }

    if (event.key === 'Escape' && this.isOpen()) {
      this.palette.close();
    }
  }

  close(): void {
    this.palette.close();
  }

  private reset(): void {
    this.query.set('');
    this.activeIndex.set(0);
    this.loading.set(false);
    this.groups.set([this.destinationGroup('')]);

    // Indispensable : sans cela, `distinctUntilChanged` garde en mémoire le
    // dernier terme cherché. Rouvrir la palette et retaper exactement la même
    // chose ne produisait alors aucune émission — donc aucun résultat, alors
    // que le champ affichait bien le terme.
    this.queryChanges.next('');
  }

  // ── Saisie et navigation clavier ───────────────────────────────────────────

  onInput(value: string): void {
    this.query.set(value);
    this.loading.set(value.trim().length >= MIN_CHARS);
    this.queryChanges.next(value);
  }

  onKeydown(event: KeyboardEvent): void {
    const results = this.flatResults();
    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.set((this.activeIndex() + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set((this.activeIndex() - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.go(results[this.activeIndex()]);
    }
  }

  /** Index d'un résultat dans la liste à plat, pour surligner le bon. */
  indexOf(result: PaletteResult): number {
    return this.flatResults().indexOf(result);
  }

  go(result: PaletteResult | undefined): void {
    if (!result) return;

    this.palette.close();
    this.router.navigate([result.route], {
      queryParams: result.queryParams ?? {},
    });
  }

  // ── Recherche ──────────────────────────────────────────────────────────────

  private search(rawTerm: string): Observable<PaletteGroup[]> {
    const term = rawTerm.trim();

    if (term.length < MIN_CHARS) {
      return of([this.destinationGroup(term)]);
    }

    const sources: Observable<PaletteGroup>[] = [of(this.destinationGroup(term))];

    if (this.auth.hasPermission('view clients')) sources.push(this.searchClients(term));
    if (this.auth.hasPermission('view sales')) sources.push(this.searchSales(term));
    if (this.auth.hasPermission('view service-orders')) sources.push(this.searchServiceOrders(term));
    if (this.auth.hasPermission('view stock')) sources.push(this.searchStock(term));

    return forkJoin(sources).pipe(
      map((groups) => groups.filter((group) => group.results.length > 0 || group.failed)),
    );
  }

  /** Les destinations viennent du même arbre que le rail : une seule vérité. */
  private destinationGroup(term: string): PaletteGroup {
    const flat: NavItem[] = [];
    const walk = (items: NavItem[]) => {
      for (const item of items) {
        if (item.route) flat.push(item);
        if (item.children) walk(item.children);
      }
    };
    walk(NAV_ITEMS);

    const results = flat
      .filter((item) => !item.permission || this.auth.hasPermission(item.permission))
      .filter((item) => !term || looseIncludes(item.label, term))
      .map<PaletteResult>((item) => ({
        kind: 'destination',
        icon: item.icon,
        label: item.label,
        sub: item.route!,
        route: item.route!,
      }));

    return { kind: 'destination', title: 'Aller à', results, failed: false };
  }

  private searchClients(term: string): Observable<PaletteGroup> {
    return this.clientService.getClients({ search: term, per_page: LIMIT }).pipe(
      map((clients) => this.group('client', 'Clients', clients.slice(0, LIMIT).map(toClientResult))),
      catchError(() => of(this.failed('client', 'Clients'))),
    );
  }

  /**
   * Le filtre `search` des ventes couvre le client, le commercial et le
   * produit — mais pas le numéro de vente, que la zone de recherche promet
   * pourtant. Une saisie entièrement numérique interroge donc la vente par son
   * identifiant, en plus de la recherche textuelle. Un 404 y est une réponse
   * normale (« pas de vente n° 9999 »), pas une panne : il ne marque rien en
   * échec.
   */
  private searchSales(term: string): Observable<PaletteGroup> {
    const byId: Observable<Sale[]> = /^\d+$/.test(term)
      ? this.saleService.getSale(Number(term)).pipe(
          map((sale) => [sale]),
          catchError(() => of([] as Sale[])),
        )
      : of([]);

    const byText = this.saleService.getSales({ search: term, per_page: String(LIMIT) }).pipe(
      map((response) => ({ sales: response.data, failed: false })),
      catchError(() => of({ sales: [] as Sale[], failed: true })),
    );

    return forkJoin([byId, byText]).pipe(
      map(([direct, text]) => {
        const seen = new Set(direct.map((sale) => sale.id));
        const rest = text.sales.filter((sale) => !seen.has(sale.id));
        const results = [...direct, ...rest].slice(0, LIMIT).map(toSaleResult);

        return { kind: 'sale' as const, title: 'Ventes', results, failed: text.failed && results.length === 0 };
      }),
    );
  }

  private searchServiceOrders(term: string): Observable<PaletteGroup> {
    return this.serviceOrderService.getServiceOrders({ search: term, per_page: String(LIMIT) }).pipe(
      map((response) => this.group('service', 'Service Auto', response.data.slice(0, LIMIT).map(toServiceResult))),
      catchError(() => of(this.failed('service', 'Service Auto'))),
    );
  }

  private searchStock(term: string): Observable<PaletteGroup> {
    return this.stockService.getGrouped({ search: term, per_page: String(LIMIT) }).pipe(
      map((response) => this.group('stock', 'Stock', (response.data ?? []).slice(0, LIMIT).map(toStockResult))),
      catchError(() => of(this.failed('stock', 'Stock'))),
    );
  }

  private group(kind: PaletteGroup['kind'], title: string, results: PaletteResult[]): PaletteGroup {
    return { kind, title, results, failed: false };
  }

  private failed(kind: PaletteGroup['kind'], title: string): PaletteGroup {
    return { kind, title, results: [], failed: true };
  }
}

// ── Mise en forme des résultats ──────────────────────────────────────────────

function toClientResult(client: Client): PaletteResult {
  return {
    kind: 'client',
    icon: 'user',
    label: client.name,
    sub: [client.city, client.phone].filter(Boolean).join(' · ') || 'Client',
    route: `/clients/${client.id}`,
  };
}

function toSaleResult(sale: Sale): PaletteResult {
  const client = sale.linked_client?.name?.trim() || 'Sans client';

  return {
    kind: 'sale',
    icon: 'tag',
    label: `Vente ${sale.id}`,
    sub: [frenchDay(sale.date), client, amount(sale.total_sale)].filter(Boolean).join(' · '),
    route: '/sales',
    queryParams: { id: String(sale.id) },
  };
}

function toServiceResult(order: ServiceOrder): PaletteResult {
  const plate = order.vehicle_data?.plate || order.vehicle || `Intervention ${order.id}`;
  const client = order.client_record?.name?.trim() ?? '';

  return {
    kind: 'service',
    icon: 'wrench',
    label: plate,
    sub: [frenchDay(order.date), client, order.status].filter(Boolean).join(' · '),
    route: '/service-orders',
    queryParams: { id: String(order.id) },
  };
}

function toStockResult(group: StockGroup): PaletteResult {
  const term = group.dimension || group.reference || '';
  const model = `${group.brand ?? ''} ${group.profile ?? ''}`.trim();

  // La marque et le profil font partie de l'étiquette, pas de la sous-ligne :
  // une recherche par dimension ramène cinq références de même dimension, et
  // cinq fois « 205/55R16 » ne se distingue pas.
  return {
    kind: 'stock',
    icon: 'package',
    label: [group.dimension || group.reference || 'Référence', model].filter(Boolean).join(' · '),
    sub: [`${group.quantity} en stock`, group.reference].filter(Boolean).join(' · '),
    route: '/stock',
    queryParams: { search: term },
  };
}

/** Aucune locale n'étant enregistrée dans l'application, le format est numérique. */
function frenchDay(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');

  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/**
 * Même séparateur que partout ailleurs dans l'application. `fr-MA` grouperait
 * par points — « 1.700 DH » se lit comme 1,7 DH — alors que les listes,
 * rendues par le pipe `number` sans locale enregistrée, affichent « 1,700 ».
 * Changer cela relève d'une décision globale, pas de la palette.
 */
function amount(value: number | null | undefined): string {
  return value == null ? '' : `${Math.round(value).toLocaleString('en-US')} DH`;
}
