import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PrimeService } from '../data-access/prime.service';
import { PrimeHistoryMonth, PrimeRow, PrimesResponse } from '../models/prime.model';

import {
  ListEmptyComponent,
  ListErrorComponent,
  SkeletonRowComponent,
  describeLoadError,
} from '../../../shared/list-state';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** `YYYY-MM-DD` dans le fuseau local — `toISOString()` décalerait d'un jour. */
function isoDay(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Primes commerciaux — refonte 2b, 9b, maquette 18a.
 *
 * La prime est collective : tant que la boutique n'a pas atteint son seuil,
 * personne ne touche rien. L'écran répond donc d'abord à « combien de pneus
 * manque-t-il, et en combien de jours », et seulement ensuite à « combien
 * touche chacun ».
 *
 * Deux choses que la maquette demande ne sont pas affichées, faute de données —
 * elles sont masquées, jamais simulées :
 *
 *   • la PROJECTION (date d'atteinte, hachures de la jauge) demande les jours
 *     ouvrés restants, donc les jours de fermeture de la boutique. Rien ne les
 *     porte : `company_settings` ne contient ni horaires ni calendrier. Ce que
 *     l'écran montre à la place est mesuré, pas extrapolé — un rythme par jour
 *     CALENDAIRE, nommé comme tel.
 *
 *   • l'HISTORIQUE des six derniers mois demande le seuil qui s'appliquait
 *     alors. `prime_threshold` est une colonne unique de `company_settings`,
 *     sans historique : le seuil d'un mois passé n'existe nulle part.
 */
@Component({
  selector: 'app-primes-page',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ListEmptyComponent,
    ListErrorComponent,
    SkeletonRowComponent,
  ],
  templateUrl: './primes-page.component.html',
  styleUrls: ['./primes-page.component.scss'],
})
export class PrimesPageComponent implements OnInit {
  readonly response = signal<PrimesResponse | null>(null);
  readonly loading = signal(false);

  // ── Refonte 2b, §14c état 3 : un chargement qui échoue ne doit pas passer
  // pour une absence de données. Cet écran n'est pas une liste filtrée : il ne
  // reçoit que cet état-là, les trois autres n'y auraient rien à dire.
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  readonly selectedYear = signal(new Date().getFullYear());
  readonly selectedMonth = signal(new Date().getMonth() + 1);

  readonly skeletonRows = Array.from({ length: 4 });

  private readonly now = new Date();
  private readonly currentYear = this.now.getFullYear();
  private readonly currentMonth = this.now.getMonth() + 1;
  private readonly today = isoDay(this.now);

  /**
   * Les jours de fermeture de la boutique. Nul, et il n'y a aujourd'hui aucun
   * moyen de les connaître : c'est ce qui tient la projection masquée. Le jour
   * où `company-settings` les portera, ce signal les recevra et le bloc de
   * projection s'allumera sans autre changement.
   */
  readonly closingDays = signal<number[] | null>(null);

  constructor(private primeService: PrimeService) {}

  // ── Le mois ────────────────────────────────────────────────────────────────

  readonly monthLabel = computed(
    () => `${MONTH_NAMES[this.selectedMonth() - 1]} ${this.selectedYear()}`,
  );

  readonly isCurrentMonth = computed(
    () => this.selectedYear() === this.currentYear && this.selectedMonth() === this.currentMonth,
  );

  readonly days = computed(() => this.response()?.daily ?? []);

  /** Le dernier jour compté : aujourd'hui pour le mois en cours, la fin sinon. */
  readonly closingDate = computed(() => {
    const days = this.days();
    if (!days.length) return null;
    return this.isCurrentMonth() ? this.today : days[days.length - 1].date;
  });

  readonly elapsedDays = computed(() => {
    const days = this.days();
    if (!days.length) return 0;
    return this.isCurrentMonth() ? this.now.getDate() : days.length;
  });

  readonly remainingDays = computed(() =>
    this.isCurrentMonth() ? Math.max(this.days().length - this.now.getDate(), 0) : 0,
  );

  // ── L'objectif ─────────────────────────────────────────────────────────────

  readonly threshold = computed(() => this.response()?.prime_threshold ?? 0);
  readonly hasThreshold = computed(() => this.threshold() > 0);
  readonly realized = computed(() => this.response()?.shop_total_tyres ?? 0);
  readonly gap = computed(() => Math.max(this.threshold() - this.realized(), 0));
  readonly reached = computed(() => this.hasThreshold() && this.realized() >= this.threshold());

  /**
   * Moyenne par jour écoulé. C'est une mesure, pas une extrapolation : elle
   * décrit le mois tel qu'il s'est passé, jours de fermeture inclus.
   */
  readonly currentPace = computed(() => {
    const days = this.elapsedDays();
    return days > 0 ? this.realized() / days : null;
  });

  /** Ce qu'il faudrait faire par jour restant pour franchir le seuil. */
  readonly requiredPace = computed(() => {
    const left = this.remainingDays();
    return this.gap() > 0 && left > 0 ? this.gap() / left : null;
  });

  /**
   * La jauge se cale sur le plus grand des deux — seuil ou réalisé. Tant que le
   * seuil n'est pas atteint, il est au bout de la barre : la barre doit aller
   * jusqu'au bout. Une fois franchi, il recule et le dépassement se voit.
   */
  readonly gaugeMax = computed(() => Math.max(this.threshold(), this.realized(), 1));
  readonly fillPct = computed(() => Math.min((this.realized() / this.gaugeMax()) * 100, 100));
  readonly thresholdPct = computed(() => (this.threshold() / this.gaugeMax()) * 100);

  // ── La répartition ─────────────────────────────────────────────────────────

  readonly rows = computed(() => this.response()?.data ?? []);

  /** Ce que la prime coûterait au compteur actuel, seuil atteint ou non. */
  primeIfReached(row: PrimeRow): number {
    return row.total_tyres * row.prime_per_tyre;
  }

  sharePct(row: PrimeRow): number {
    const total = this.realized();
    return total > 0 ? (row.total_tyres / total) * 100 : 0;
  }

  readonly costAtRealized = computed(() =>
    this.rows().reduce((sum, row) => sum + this.primeIfReached(row), 0),
  );

  /** La ligne « Boutique » ferme le registre sur les mêmes colonnes. */
  readonly shopSaleTyres = computed(() =>
    this.rows().reduce((sum, row) => sum + row.sale_tyres, 0),
  );

  readonly shopSoTyres = computed(() =>
    this.rows().reduce((sum, row) => sum + row.so_tyres, 0),
  );

  readonly netMargin = computed(() => this.response()?.net_margin ?? 0);

  /**
   * Nul si la marge nette est négative ou nulle : « 14,2 % d'une perte » ne
   * veut rien dire, et un pourcentage négatif se lirait à l'envers.
   */
  readonly marginShare = computed(() => {
    const margin = this.netMargin();
    return margin > 0 ? (this.costAtRealized() / margin) * 100 : null;
  });

  /**
   * Les taux sont par commercial ; la règle ne se résume en une phrase que
   * s'ils coïncident. Deux membres plutôt qu'un `as` de gabarit : un taux
   * uniforme de 0 est une valeur, pas une absence.
   */
  readonly uniformRate = computed(() => {
    const rates = new Set(this.rows().map((row) => row.prime_per_tyre));
    return rates.size === 1 ? [...rates][0] : null;
  });

  readonly hasUniformRate = computed(() => this.uniformRate() !== null);

  // ── Ce qui reste masqué ────────────────────────────────────────────────────

  /** Voir l'en-tête de classe : sans jours de fermeture, pas de projection. */
  readonly canProject = computed(() => this.closingDays() !== null);

  readonly history = computed(() => this.response()?.history ?? []);

  /** Un mois passé se lit contre le seuil qui valait alors, pas contre l'actuel. */
  histPct(past: PrimeHistoryMonth): number {
    const scale = Math.max(past.prime_threshold, past.shop_total_tyres, 1);
    return (past.shop_total_tyres / scale) * 100;
  }

  // ── Chargement ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.primeService.getPrimes(this.selectedYear(), this.selectedMonth()).subscribe({
      next: (res) => {
        this.response.set(res);
        this.loading.set(false);
        this.loadError.set(null);
        this.lastLoadedAt.set(new Date());
      },
      error: (err) => {
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
      },
    });
  }

  prevMonth(): void {
    if (this.selectedMonth() === 1) {
      this.selectedMonth.set(12);
      this.selectedYear.update((y) => y - 1);
    } else {
      this.selectedMonth.update((m) => m - 1);
    }
    this.loadData();
  }

  nextMonth(): void {
    if (this.isCurrentMonth()) return;
    if (this.selectedMonth() === 12) {
      this.selectedMonth.set(1);
      this.selectedYear.update((y) => y + 1);
    } else {
      this.selectedMonth.update((m) => m + 1);
    }
    this.loadData();
  }

  // ── Formats ────────────────────────────────────────────────────────────────

  formatAmount(value: number): string {
    return value.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatRate(value: number): string {
    return value.toLocaleString('fr-MA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  /** `2026-09-17` → `17/09`. */
  formatDay(iso: string | null): string {
    if (!iso) return '—';
    const [, month, day] = iso.split('-');
    return `${day}/${month}`;
  }

  /** La sous-ligne de repli : ce que portent les colonnes tombées sous 1200 px. */
  foldedSubLineFor(row: PrimeRow): string {
    return `${row.sale_tyres} en vente · ${row.so_tyres} en service`;
  }

  /** Ce que le passage en fiche fait tomber en plus, sous 900 px. */
  cardSubLineFor(row: PrimeRow): string {
    return `${row.total_tyres} pneus · ${this.formatRate(this.sharePct(row))} % du collectif`;
  }
}
