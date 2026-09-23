import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PrimeService } from '../data-access/prime.service';
import { SettingsService } from '../../settings/data-access/settings.service';
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
 * Les jours ouvrés viennent des jours de fermeture de `company-settings`
 * (`closed_weekdays`, `holidays`). Tant que ce chargement n'a pas répondu, la
 * projection reste éteinte plutôt que de tourner sur une semaine supposée.
 *
 * L'historique vient de `prime_thresholds`, qui garde le seuil et sa date de
 * prise d'effet. Un mois antérieur à la première ligne revient sans seuil : la
 * table a commencé à compter le jour de sa création et ne récupère rien
 * d'avant. Ces mois-là s'affichent en tiret, sans verdict.
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
   * Les jours de fermeture hebdomadaires, 0 (dimanche) à 6 (samedi). Nul tant
   * que `company-settings` n'a pas répondu — c'est ce qui tient la projection
   * éteinte à ce moment-là. Une liste vide est une réponse : la boutique ouvre
   * tous les jours.
   */
  readonly closingDays = signal<number[] | null>(null);

  /** Les fermetures exceptionnelles, en `YYYY-MM-DD`. */
  readonly holidays = signal<string[]>([]);

  constructor(
    private primeService: PrimeService,
    private settingsService: SettingsService,
  ) {}

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

  /** Les jours déjà comptés : du 1er à aujourd'hui, ou le mois entier s'il est clos. */
  readonly elapsedDays = computed(() => {
    const days = this.days();
    if (!days.length) return [];
    const stop = this.isCurrentMonth() ? this.now.getDate() : days.length;
    return days.slice(0, stop);
  });

  /** Les jours qui restent : après aujourd'hui, et rien pour un mois clos. */
  readonly futureDays = computed(() =>
    this.isCurrentMonth() ? this.days().slice(this.now.getDate()) : [],
  );

  // ── Jours ouvrés ───────────────────────────────────────────────────────────

  /**
   * Un jour ouvré est un jour où la boutique vend : ni fermeture hebdomadaire,
   * ni fermeture exceptionnelle. Faux pour tout le monde tant que les jours de
   * fermeture ne sont pas connus — c'est `canProject()` qui garde l'écran de
   * s'en servir avant.
   */
  isWorkingDay(iso: string): boolean {
    const closed = this.closingDays();
    if (closed === null) return false;
    if (this.holidays().includes(iso)) return false;
    return !closed.includes(new Date(`${iso}T00:00:00`).getDay());
  }

  readonly workingDaysElapsed = computed(
    () => this.elapsedDays().filter((day) => this.isWorkingDay(day.date)).length,
  );

  readonly workingDaysRemaining = computed(
    () => this.futureDays().filter((day) => this.isWorkingDay(day.date)).length,
  );

  // ── L'objectif ─────────────────────────────────────────────────────────────

  readonly threshold = computed(() => this.response()?.prime_threshold ?? 0);
  readonly hasThreshold = computed(() => this.threshold() > 0);
  readonly realized = computed(() => this.response()?.shop_total_tyres ?? 0);
  readonly gap = computed(() => Math.max(this.threshold() - this.realized(), 0));
  readonly reached = computed(() => this.hasThreshold() && this.realized() >= this.threshold());

  /**
   * Moyenne par jour ouvré écoulé. C'est une mesure, pas une extrapolation :
   * elle décrit le mois tel qu'il s'est passé.
   */
  readonly currentPace = computed(() => {
    const days = this.workingDaysElapsed();
    return days > 0 ? this.realized() / days : null;
  });

  /** Ce qu'il faudrait faire par jour ouvré restant pour franchir le seuil. */
  readonly requiredPace = computed(() => {
    const left = this.workingDaysRemaining();
    return this.gap() > 0 && left > 0 ? this.gap() / left : null;
  });

  // ── Projection ─────────────────────────────────────────────────────────────

  /**
   * Là où le mois finira si le rythme tient. Nul sans jours de fermeture
   * connus, sans rythme mesurable, ou sur un mois déjà clos — dans ces trois
   * cas il n'y a rien à projeter, et l'écran n'affiche rien.
   */
  readonly projectedTotal = computed(() => {
    const pace = this.currentPace();
    if (!this.canProject() || pace === null || !this.isCurrentMonth()) return null;
    return Math.round(this.realized() + pace * this.workingDaysRemaining());
  });

  /**
   * Le jour où le compteur franchit le seuil au rythme actuel. Nul si le seuil
   * est déjà atteint, ou si le rythme ne suffit pas d'ici la fin du mois.
   *
   * On annonce le jour ouvré LE PLUS PROCHE du franchissement, pas le premier
   * dont le cumul de fin de journée dépasse le seuil. Avec 203 pneus à 46,5
   * par jour, il faut 4,4 jours ouvrés : le 4e est le 22/09, le 5e le 23/09
   * (le dimanche 20 étant sauté), et le franchissement tombe dans le premier
   * tiers du 23. C'est le 22 qui est annoncé — la lecture de la maquette 18a.
   *
   * Le revers assumé : au soir du jour annoncé le cumul projeté peut être
   * légèrement sous le seuil (883 sur 900 dans cet exemple). L'annonce est
   * donc optimiste d'une demi-journée au plus. Passer `Math.round` en
   * `Math.ceil` ci-dessous rend l'annonce strictement atteignable, au prix
   * d'un jour entier de retard pour quelques pneus.
   */
  readonly projectedDate = computed(() => {
    const pace = this.currentPace();
    if (!this.canProject() || pace === null || pace <= 0) return null;
    if (!this.hasThreshold() || this.reached()) return null;

    const working = this.futureDays().filter((day) => this.isWorkingDay(day.date));
    const needed = Math.max(Math.round(this.gap() / pace), 1);

    return working[needed - 1]?.date ?? null;
  });

  /**
   * La jauge se cale sur le plus grand des trois — seuil, réalisé, projection.
   * Tant que le seuil n'est pas atteint et qu'on ne projette pas, il est au
   * bout de la barre : la barre doit aller jusqu'au bout. Dès qu'il est
   * dépassé, ou qu'une projection va plus loin, il recule et l'écart se voit.
   */
  readonly gaugeMax = computed(() =>
    Math.max(this.threshold(), this.realized(), this.projectedTotal() ?? 0, 1),
  );
  readonly fillPct = computed(() => Math.min((this.realized() / this.gaugeMax()) * 100, 100));
  readonly thresholdPct = computed(() => (this.threshold() / this.gaugeMax()) * 100);

  /** La projection franchit-elle le seuil ? Faux s'il n'y en a pas. */
  readonly projectionMakesIt = computed(() => {
    const projected = this.projectedTotal();
    return this.hasThreshold() && projected !== null && projected >= this.threshold();
  });

  /** La largeur des hachures : ce que la projection ajoute au réalisé. */
  readonly projectionPct = computed(() => {
    const projected = this.projectedTotal();
    if (projected === null) return 0;
    return Math.max((projected / this.gaugeMax()) * 100 - this.fillPct(), 0);
  });

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
   * Ce que la prime coûterait si le mois finissait sur la projection. Le coût
   * suit le nombre de pneus, donc il se met à l'échelle dans le même rapport —
   * répartir la projection commercial par commercial supposerait que chacun
   * garde sa part, ce que rien ne garantit.
   */
  readonly costAtProjection = computed(() => {
    const projected = this.projectedTotal();
    const realized = this.realized();
    if (projected === null || realized <= 0) return null;
    return (this.costAtRealized() * projected) / realized;
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

  /** Sans jours de fermeture connus, rien ne se projette. */
  readonly canProject = computed(() => this.closingDays() !== null);

  // ── Les six derniers mois ──────────────────────────────────────────────────

  readonly history = computed(() => this.response()?.history ?? []);

  /**
   * Un mois passé se lit contre le seuil qui valait ALORS, jamais contre
   * l'actuel. Faute de seuil connu, la barre se cale sur le plus gros mois de
   * la série : elle reste comparable aux autres sans prétendre à un verdict.
   */
  histPct(past: PrimeHistoryMonth): number {
    const scale = past.prime_threshold
      ? Math.max(past.prime_threshold, past.shop_total_tyres)
      : Math.max(...this.history().map((month) => month.shop_total_tyres), 1);
    return (past.shop_total_tyres / Math.max(scale, 1)) * 100;
  }

  histReached(past: PrimeHistoryMonth): boolean {
    return past.prime_threshold !== null && past.shop_total_tyres >= past.prime_threshold;
  }

  /** `{year: 2026, month: 8}` → `Août`. */
  histLabel(past: PrimeHistoryMonth): string {
    return MONTH_NAMES[past.month - 1];
  }

  // ── Chargement ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadClosingDays();
    this.loadData();
  }

  /**
   * Les jours de fermeture, d'où sortent les jours ouvrés. Un échec laisse
   * `closingDays` à null, donc la projection éteinte : mieux vaut ne rien
   * annoncer que de compter sur une semaine supposée.
   */
  private loadClosingDays(): void {
    this.settingsService.getCompanySettings().subscribe({
      next: (settings) => {
        this.closingDays.set(settings.closed_weekdays ?? [0]);
        this.holidays.set(settings.holidays ?? []);
      },
      error: () => {},
    });
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
