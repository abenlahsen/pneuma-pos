import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { ErrorBannerComponent, formatErrorDetail } from '../../../shared/error-banner/error-banner.component';
import { PlanningCard, WorkshopPlanning } from '../models/planning.model';

/** Une carte placée : position et hauteur, toutes deux en pourcentage de l'axe. */
export interface PlacedCard {
  card: PlanningCard;
  top: number;
  height: number;
  label: string;
}

/** Amplitude de l'atelier : 09:00 → 17:00, huit lignes égales. */
export const DAY_START_MIN = 9 * 60;
export const DAY_END_MIN = 17 * 60;
export const DAY_SPAN_MIN = DAY_END_MIN - DAY_START_MIN;

/**
 * Minutes depuis minuit pour un `YYYY-MM-DD HH:mm`. Volontairement sans `Date` :
 * le serveur envoie une heure locale d'atelier, la reinterpreter en UTC la
 * decalerait.
 */
export function minutesOf(value: string | null): number | null {
  if (!value) return null;

  const m = /(\d{2}):(\d{2})$/.exec(value.trim());

  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * LA fonction du temps (`3f`). Une carte n'est jamais empilee en flux avec une
 * hauteur ecrite a la main : sa position encode l'heure, sinon il n'y a plus
 * aucune regle de placement. Le trait de l'heure courante sort d'ici aussi.
 */
export function positionOf(startMin: number, durationMin: number): { top: number; height: number } {
  const top = ((startMin - DAY_START_MIN) / DAY_SPAN_MIN) * 100;
  const height = (durationMin / DAY_SPAN_MIN) * 100;

  return {
    top: Math.max(0, Math.min(100, Math.round(top * 10) / 10)),
    height: Math.max(0, Math.min(100 - Math.max(0, top), Math.round(height * 10) / 10)),
  };
}

const HHMM = (min: number) =>
  String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

/**
 * Planning de l'atelier (`3f`) — le seul ecran de l'application qui n'est pas
 * un tableau, et le seul qui demande un calcul. Dans une liste triee par date
 * on ne voit ni les trous ni les chevauchements, c'est-a-dire precisement ce
 * qu'on vient chercher.
 */
@Component({
  selector: 'app-workshop-planning',
  standalone: true,
  imports: [CommonModule, IconComponent, ErrorBannerComponent],
  templateUrl: './workshop-planning.component.html',
  styleUrl: './workshop-planning.component.scss',
})
export class WorkshopPlanningComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly pageHeader = inject(PageHeaderService);

  readonly planning = signal<WorkshopPlanning | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly day = signal(new Date().toISOString().slice(0, 10));
  readonly dragged = signal<PlanningCard | null>(null);

  /** Formatee ici : le pipe `date` sortirait de l'anglais, la locale `fr`
   *  n'etant pas enregistree (elle reformaterait tous les nombres). */
  readonly dayLabel = computed(() =>
    new Date(this.day()).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  );

  /** Les huit lignes de l'axe, 13:00 incluse. */
  readonly hours = computed(() => {
    const rows: string[] = [];
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += 60) rows.push(HHMM(m));

    return rows;
  });

  /** La bande hachurée de la pause. */
  readonly lunch = computed(() => positionOf(13 * 60, 60));

  /**
   * Trait de l'heure courante — même formule que les cartes. Absent hors de
   * l'amplitude : une ligne collée en haut mentirait.
   */
  readonly nowLine = computed(() => {
    if (this.day() !== new Date().toISOString().slice(0, 10)) return null;

    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes();
    if (min < DAY_START_MIN || min > DAY_END_MIN) return null;

    return positionOf(min, 0).top;
  });

  cardsFor(bayId: number): PlacedCard[] {
    return (this.planning()?.scheduled ?? [])
      .filter((c) => c.bay_id === bayId)
      .map((card) => {
        const start = minutesOf(card.scheduled_at) ?? DAY_START_MIN;
        const duration = card.duration_minutes ?? 60;
        const { top, height } = positionOf(start, duration);

        return { card, top, height, label: `${HHMM(start)} – ${HHMM(start + duration)}` };
      });
  }

  ngOnInit(): void {
    this.pageHeader.set('Service Auto');
    this.pageHeader.setRefresh('service-planning', () => this.load());
    this.load();
  }

  ngOnDestroy(): void {
    this.pageHeader.clear();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');

    this.http.get<WorkshopPlanning>(`${environment.apiUrl}/service-orders-planning`, { params: { date: this.day() } })
      .subscribe({
        next: (planning) => {
          this.planning.set(planning);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.loadError.set(formatErrorDetail('GET', err?.url ?? '/api/service-orders-planning', err?.status ?? 0));
        },
      });
  }

  shiftDay(days: number): void {
    const d = new Date(this.day());
    d.setDate(d.getDate() + days);
    this.day.set(d.toISOString().slice(0, 10));
    this.load();
  }

  // ── Glisser-déposer : on fait glisser une carte de la file dans une baie ──

  onDragStart(card: PlanningCard): void {
    this.dragged.set(card);
  }

  /**
   * Le point de depot décide l'heure : l'ordonnée dans la colonne est une
   * fraction de l'amplitude, arrondie au quart d'heure — poser une carte à
   * 09:07 n'aurait aucun sens à l'atelier.
   */
  onDrop(bayId: number, event: DragEvent): void {
    event.preventDefault();

    const card = this.dragged();
    if (!card) return;

    const column = event.currentTarget as HTMLElement;
    const ratio = (event.clientY - column.getBoundingClientRect().top) / column.getBoundingClientRect().height;
    const raw = DAY_START_MIN + ratio * DAY_SPAN_MIN;
    const start = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - 15, Math.round(raw / 15) * 15));

    this.dragged.set(null);
    this.schedule(card, bayId, `${this.day()} ${HHMM(start)}`);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  /** Renvoie une carte dans la file d'attente. */
  unschedule(card: PlanningCard): void {
    this.schedule(card, null, null);
  }

  private schedule(card: PlanningCard, bayId: number | null, startsAt: string | null): void {
    this.http.put(`${environment.apiUrl}/service-orders/${card.id}/schedule`, {
      bay_id: bayId,
      scheduled_at: startsAt,
      duration_minutes: card.duration_minutes ?? 60,
    }).subscribe({
      next: () => this.load(),
      error: (err) => this.loadError.set(
        formatErrorDetail('PUT', err?.url ?? `/api/service-orders/${card.id}/schedule`, err?.status ?? 0),
      ),
    });
  }
}
