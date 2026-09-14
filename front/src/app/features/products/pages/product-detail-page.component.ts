import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { ErrorBannerComponent, formatErrorDetail } from '../../../shared/error-banner/error-banner.component';
import { ProductProfile } from '../models/product-profile.model';

type ProductTab = 'detail' | 'movements' | 'prices' | 'suppliers';

/** Une barre de l'historique douze mois. */
interface HistoryBar {
  month: string;
  label: string;
  quantity: number;
  height: number;
}

/**
 * Fiche produit (`3e`) — second gabarit de reference apres la fiche client.
 *
 * En-tete d'objet, onglets, deux colonnes. Le detail qui compte est le bandeau
 * de disponible : « 6 en stock » ne veut rien dire tout seul, c'est la seule
 * question qu'on pose vraiment devant un client.
 */
@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, ErrorBannerComponent],
  templateUrl: './product-detail-page.component.html',
  styleUrl: './product-detail-page.component.scss',
})
export class ProductDetailPageComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly pageHeader = inject(PageHeaderService);

  readonly profile = signal<ProductProfile | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly activeTab = signal<ProductTab>('detail');

  readonly product = computed(() => this.profile()?.product ?? null);

  /** Marque + dimension + profil : ce qu'on prononce au comptoir. */
  readonly title = computed(() => {
    const p = this.product();
    if (!p) return '';

    const tyre = p.tyre;
    const dimension = tyre?.tire_width ? `${tyre.tire_width}/${tyre.tire_height}R${tyre.tire_diameter}` : '';

    return [p.brand?.name, dimension, p.profile].filter(Boolean).join(' ') || `Article #${p.id}`;
  });

  readonly kicker = computed(() => {
    const p = this.product();
    if (!p) return '';

    return p.type === 'tyre' ? 'Pneumatique' : p.type === 'part' ? 'Pièce détachée' : 'Prestation';
  });

  /** Dimension, référence, code-barres — la ligne d'identifiants de `3e`. */
  readonly identifiers = computed(() => {
    const p = this.product();
    if (!p) return [];

    const tyre = p.tyre;

    return [
      tyre?.tire_width ? `${tyre.tire_width}/${tyre.tire_height}R${tyre.tire_diameter}` : null,
      p.reference,
      tyre?.tire_load_index && tyre?.tire_speed_index ? `${tyre.tire_load_index}${tyre.tire_speed_index}` : null,
    ].filter(Boolean) as string[];
  });

  /** Caracteristiques en paires cle/valeur, sur deux colonnes. */
  readonly characteristics = computed<Array<{ key: string; value: string }>>(() => {
    const p = this.product();
    if (!p) return [];

    const t = p.tyre;
    const pairs: Array<[string, unknown]> = [
      ['Marque', p.brand?.name],
      ['Profil', p.profile],
      ['Largeur', t?.tire_width],
      ['Hauteur', t?.tire_height],
      ['Diamètre', t?.tire_diameter],
      ['Indice de charge', t?.tire_load_index],
      ['Indice de vitesse', t?.tire_speed_index],
      ['Saison', t?.tire_season],
      ['Unité', p.unit],
    ];

    return pairs
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([key, v]) => ({ key, value: String(v) }));
  });

  private readonly historyMax = computed(() =>
    Math.max(0, ...(this.profile()?.history ?? []).map((h) => h.quantity)),
  );

  /** Douze barres : un mois creux doit se voir, pas disparaitre. */
  readonly historyBars = computed<HistoryBar[]>(() => {
    const max = this.historyMax();

    return (this.profile()?.history ?? []).map((h) => ({
      month: h.month,
      label: h.month.slice(5) + '/' + h.month.slice(2, 4),
      quantity: h.quantity,
      height: max === 0 ? 0 : Math.round((h.quantity / max) * 1000) / 10,
    }));
  });

  /** Part du prix d'achat dans le prix de vente, pour la barre de marge. */
  readonly purchaseShare = computed(() => {
    const m = this.profile()?.margin;
    if (!m || m.selling_price <= 0) return 0;

    return Math.min(100, Math.round((m.purchase_price / m.selling_price) * 1000) / 10);
  });

  private readonly headerEffect = effect(() => {
    this.pageHeader.set('Produits');
    this.pageHeader.setBreadcrumb(this.product()?.reference ? [this.product()!.reference!] : []);
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(id) && id > 0) this.load(id);
  }

  ngOnDestroy(): void {
    this.pageHeader.clear();
  }

  load(id: number): void {
    this.loading.set(true);
    this.loadError.set('');

    this.http.get<ProductProfile>(`${environment.apiUrl}/products/${id}/profile`).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(formatErrorDetail('GET', err?.url ?? `/api/products/${id}/profile`, err?.status ?? 0));
      },
    });
  }

  setTab(tab: ProductTab): void {
    this.activeTab.set(tab);
  }
}
