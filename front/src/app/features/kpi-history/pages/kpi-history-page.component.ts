import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IconComponent } from '../../../shared/icon/icon.component';
import { KpiHistoryService } from '../data-access/kpi-history.service';
import { SettingsService } from '../../settings/data-access/settings.service';
import { CommercialKpi, DashboardKpi, KpiSnapshot } from '../models/kpi-history.model';
import { KpiDay } from '../models/kpi-day.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';

import { ListErrorComponent, SkeletonRowComponent, describeLoadError } from '../../../shared/list-state';

const WEEKDAY_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

/** Garde-fou : une plage aberrante ne doit pas générer des milliers de lignes. */
const MAX_DAYS = 120;

/** Le paramètre d'URL qui veut dire « le jour le plus récent ». */
const LATEST = 'latest';

/** `Date` → `YYYY-MM-DD` en heure locale — `toISOString()` décalerait d'un jour. */
function isoDay(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function parseDay(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function addDays(iso: string, delta: number): string {
  const date = parseDay(iso);
  date.setDate(date.getDate() + delta);
  return isoDay(date);
}

/**
 * Historique KPI — refonte 2b, 9c, maquette 18b.
 *
 * L'écran se divise en deux : la liste des jours à gauche, le détail du jour
 * sélectionné à droite. La modale et les deux onglets ont disparu ; le détail
 * empile ses trois blocs au lieu de les cacher l'un derrière l'autre.
 *
 * Le point de fond : la liste affiche des JOURS, pas des instantanés. Un jour
 * sans instantané ne disparaît plus, il se montre — et il se qualifie, parce
 * que les deux causes d'absence n'appellent pas la même réaction. Fermeture
 * de la boutique : normal. Jour ouvré sans instantané : la tâche planifiée de
 * 00:05 n'a pas tourné, et ça doit se voir.
 */
@Component({
  selector: 'app-kpi-history-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AutoRefreshControlComponent,
    IconComponent,
    ListErrorComponent,
    SkeletonRowComponent,
  ],
  templateUrl: './kpi-history-page.component.html',
  styleUrl: './kpi-history-page.component.scss',
})
export class KpiHistoryPageComponent implements OnInit {
  readonly snapshots = signal<KpiSnapshot[]>([]);
  readonly loading = signal(false);

  // ── Refonte 2b, §14c état 3 : un chargement qui échoue ne doit pas passer
  // pour une absence de données.
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  readonly totalPages = signal(0);
  readonly totalItems = signal(0);

  /** Huit lignes de squelette : la hauteur d'une liste de jours bien remplie. */
  readonly skeletonRows = Array.from({ length: 8 });

  readonly filterFrom = signal('');
  readonly filterTo = signal('');
  readonly page = signal(1);
  readonly perPage = 30;

  /** Le panneau des deux dates, replié derrière le jeton — comme sur Ventes. */
  readonly periodOpen = signal(false);

  /** Le jour affiché à droite, `YYYY-MM-DD`. Vient de l'URL. */
  readonly selectedDate = signal<string | null>(null);

  /** Jours de fermeture — voir `dayKind()`. Null tant que non chargés. */
  readonly closedWeekdays = signal<number[] | null>(null);
  readonly holidays = signal<string[]>([]);

  constructor(
    private svc: KpiHistoryService,
    private settingsService: SettingsService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const date = params.get('date');
      // `latest` n'est pas un jour : c'est la demande « le plus récent », qui
      // ne se résout qu'une fois les données là.
      this.selectedDate.set(date === LATEST ? null : date);
      this.ensureSelection();
    });
    this.loadClosingDays();
    this.load();
  }

  // ── Chargement ─────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.svc
      .getHistory({
        from: this.filterFrom() || undefined,
        to: this.filterTo() || undefined,
        page: this.page(),
        per_page: this.perPage,
      })
      .subscribe({
        next: (res) => {
          this.snapshots.set(res.data);
          this.totalPages.set(res.meta.last_page);
          this.totalItems.set(res.meta.total);
          this.loading.set(false);
          this.loadError.set(null);
          this.lastLoadedAt.set(new Date());
          this.ensureSelection();
        },
        error: (err) => {
          const { cause, detail } = describeLoadError(err);
          this.loadError.set(cause);
          this.loadErrorDetail.set(detail);
          this.loading.set(false);
        },
      });
  }

  /**
   * Les jours de fermeture, qui distinguent « Fermé » de « Aucun instantané ».
   * Un échec les laisse à null : tous les trous deviennent alors « Aucun
   * instantané », ce qui alerte à tort plutôt que de rassurer à tort.
   */
  private loadClosingDays(): void {
    this.settingsService.getCompanySettings().subscribe({
      next: (settings) => {
        this.closedWeekdays.set(settings.closed_weekdays ?? [0]);
        this.holidays.set(settings.holidays ?? []);
      },
      error: () => {},
    });
  }

  // ── La suite continue des jours ────────────────────────────────────────────

  private readonly byDate = computed(() => {
    const map = new Map<string, KpiSnapshot>();
    for (const snap of this.snapshots()) map.set(snap.snapshot_date.slice(0, 10), snap);
    return map;
  });

  /**
   * Le haut de la liste. La tâche tourne à 00:05 pour la veille : le jour le
   * plus récent qui PEUT avoir un instantané est donc hier, jamais aujourd'hui.
   * Prendre la date du dernier instantané ferait disparaître une panne — c'est
   * exactement le trou qu'on veut voir.
   *
   * Sur une page suivante, on repart du dernier instantané de la page : il n'y
   * a plus de « manque » à signaler au-delà de ce que la page couvre.
   */
  private readonly rangeEnd = computed(() => {
    if (this.filterTo()) return this.filterTo();

    const dates = [...this.byDate().keys()].sort();
    if (this.page() > 1) return dates.at(-1) ?? null;

    const yesterday = addDays(isoDay(new Date()), -1);
    const newest = dates.at(-1);
    // Si l'instantané le plus récent est postérieur à hier (horloge décalée),
    // c'est lui qui borne : on n'invente pas de jour au-delà des données.
    return newest && newest > yesterday ? newest : yesterday;
  });

  private readonly rangeStart = computed(() => {
    if (this.filterFrom()) return this.filterFrom();
    return [...this.byDate().keys()].sort()[0] ?? null;
  });

  /** Qu'est-ce qu'on sait de ce jour ? Voir `KpiDayKind`. */
  private dayKind(iso: string): KpiDay['kind'] {
    if (this.byDate().has(iso)) return 'snapshot';

    const closed = this.closedWeekdays();
    if (closed === null) return 'missing';
    if (this.holidays().includes(iso)) return 'closed';
    return closed.includes(parseDay(iso).getDay()) ? 'closed' : 'missing';
  }

  readonly days = computed<KpiDay[]>(() => {
    const end = this.rangeEnd();
    const start = this.rangeStart();
    if (!end || !start || start > end) return [];

    const rows: KpiDay[] = [];
    let cursor = end;

    while (cursor >= start && rows.length < MAX_DAYS) {
      const kind = this.dayKind(cursor);
      rows.push({ date: cursor, kind, snapshot: this.byDate().get(cursor) ?? null });
      cursor = addDays(cursor, -1);
    }

    return rows;
  });

  /** Les jours consultables : ceux qui portent un instantané. */
  private readonly navigableDays = computed(() => this.days().filter((day) => day.kind === 'snapshot'));

  readonly missingCount = computed(() => this.days().filter((day) => day.kind === 'missing').length);

  // ── Sélection et navigation ────────────────────────────────────────────────

  readonly selected = computed(
    () => this.navigableDays().find((day) => day.date === this.selectedDate())?.snapshot ?? null,
  );

  private readonly selectedIndex = computed(() =>
    this.navigableDays().findIndex((day) => day.date === this.selectedDate()),
  );

  /** ↑ remonte vers les jours récents, ↓ descend — l'ordre de la liste. */
  readonly hasNewer = computed(() => this.selectedIndex() > 0);
  readonly hasOlder = computed(() => {
    const index = this.selectedIndex();
    return index >= 0 && index < this.navigableDays().length - 1;
  });

  /**
   * Résout `latest`, et rattrape une date d'URL qui ne correspond à aucun
   * instantané chargé — un lien vers un jour fermé, par exemple.
   */
  private ensureSelection(): void {
    const current = this.selectedDate();
    const days = this.navigableDays();
    if (current && days.some((day) => day.date === current)) return;

    const fallback = days[0]?.date ?? null;
    if (fallback) this.select(fallback, true);
  }

  select(date: string, replaceUrl = false): void {
    this.router.navigate(['/kpi-history', date], { replaceUrl });
  }

  step(delta: number): void {
    const index = this.selectedIndex();
    const next = this.navigableDays()[index + delta];
    if (next) this.select(next.date);
  }

  /**
   * ↑ et ↓ passent d'un jour à l'autre. Ignorées pendant une saisie, sinon on
   * ne pourrait plus déplacer le curseur dans les champs de date.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

    event.preventDefault();
    this.step(event.key === 'ArrowUp' ? -1 : 1);
  }

  // ── Filtres ────────────────────────────────────────────────────────────────

  readonly hasPeriod = computed(() => !!this.filterFrom() || !!this.filterTo());

  readonly periodLabel = computed(() => {
    const from = this.filterFrom();
    const to = this.filterTo();
    if (from && to) return `Du ${this.fmtDate(from)} au ${this.fmtDate(to)}`;
    if (from) return `Depuis le ${this.fmtDate(from)}`;
    return `Jusqu'au ${this.fmtDate(to)}`;
  });

  applyFilters(): void {
    this.page.set(1);
    this.periodOpen.set(false);
    this.load();
  }

  clearPeriod(): void {
    this.filterFrom.set('');
    this.filterTo.set('');
    this.page.set(1);
    this.periodOpen.set(false);
    this.load();
  }

  goPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  // ── Formats ────────────────────────────────────────────────────────────────

  fmt(v: number | undefined | null): string {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }

  fmtInt(v: number | undefined | null): string {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-MA').format(v);
  }

  /**
   * Un taux à une décimale. Pas le pipe `number` : l'application n'enregistre
   * aucun LOCALE_ID, il rendrait « 32.4 » là où tout le reste de l'écran écrit
   * « 32,4 » via Intl.
   */
  fmtRate(v: number | undefined | null): string {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
  }

  fmtDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  /** `2026-09-16` → `Mar. 16` — la colonne étroite de la liste. */
  shortDay(iso: string): string {
    const date = parseDay(iso);
    return `${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()}`;
  }

  /** `2026-09-16` → `Mardi 16 septembre 2026` — le titre du détail. */
  longDay(iso: string): string {
    return parseDay(iso).toLocaleDateString('fr-MA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * Quand l'instantané a été pris. La maquette écrit « instantané de 23:59 »,
   * mais la tâche tourne à 00:05 LE LENDEMAIN du jour mesuré : afficher une
   * heure seule laisserait croire qu'elle appartient au jour affiché. La date
   * de relevé est donc écrite en entier dès qu'elle diffère.
   */
  snapshotTaken(snap: KpiSnapshot): string {
    const at = new Date(snap.created_at);
    if (Number.isNaN(at.getTime())) return '';

    const time = at.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
    const day = isoDay(at);

    return day === snap.snapshot_date.slice(0, 10)
      ? `relevé à ${time}`
      : `relevé le ${this.fmtDate(day)} à ${time}`;
  }

  // ── Le détail ──────────────────────────────────────────────────────────────

  globalRows(data: DashboardKpi): { label: string; today: string; month: string; year: string }[] {
    return [
      { label: "Chiffre d'affaires", today: this.fmt(data.sales_today_amount), month: this.fmt(data.sales_month_amount), year: this.fmt(data.total_sale_year) },
      { label: 'Achats', today: this.fmt(data.purchases_today_amount), month: this.fmt(data.purchases_month_amount), year: this.fmt(data.total_purchase_year) },
      { label: 'Marge brute', today: this.fmt(data.margin_today), month: this.fmt(data.margin_month), year: this.fmt(data.margin_year) },
      { label: 'Marge nette', today: this.fmt(data.net_margin_today), month: this.fmt(data.net_margin_month), year: this.fmt(data.net_margin_year) },
      { label: 'Dépenses', today: this.fmt(data.expenses_today), month: this.fmt(data.expenses_month), year: this.fmt(data.expenses_year) },
      { label: 'Pneus vendus', today: this.fmtInt(data.tyres_today), month: this.fmtInt(data.tyres_month), year: this.fmtInt(data.tyres_year) },
      { label: 'Pneus achetés', today: this.fmtInt(data.tyres_purchased_today), month: this.fmtInt(data.tyres_purchased_month), year: this.fmtInt(data.tyres_purchased_year) },
      // Le KPI ne porte pas de compte de pièces à la journée : la colonne
      // « ce jour » reste vide plutôt que de recopier le mois.
      { label: 'Pièces vendues', today: '—', month: this.fmtInt(data.parts_month), year: this.fmtInt(data.parts_year) },
      { label: 'Pièces achetées', today: '—', month: this.fmtInt(data.parts_purchased_month), year: this.fmtInt(data.parts_purchased_year) },
    ];
  }

  /**
   * La ligne « dont service auto » — refonte 2b, 9c.
   *
   * Les deux tableaux par commercial fusionnent : les vendeurs gardent leurs
   * lignes, le service auto devient un total dessous. Le service ventilé par
   * vendeur reste dans Reporting, qui est l'écran fait pour ça.
   */
  serviceTotal(data: DashboardKpi): { ca: number; orders: number; margin: number; unpaid: number; rate: number } | null {
    const rows = data.service_by_commercial ?? [];
    if (!rows.length) return null;

    const sum = (pick: (row: CommercialKpi) => number | undefined) =>
      rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

    const ca = sum((row) => row.total_ca);
    const margin = sum((row) => row.total_margin);

    return {
      ca,
      orders: sum((row) => row.total_orders),
      margin,
      unpaid: sum((row) => row.total_unpaid),
      rate: ca > 0 ? (margin / ca) * 100 : 0,
    };
  }
}
