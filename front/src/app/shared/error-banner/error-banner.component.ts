import { Component, input, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Compose le détail technique affiché par le bandeau :
 *
 *   formatErrorDetail('GET', 'http://localhost:8888/api/sales?page=1', 504)
 *   → 'GET /api/sales — 504 · 14:22:07'
 *
 * L'origine et la chaîne de requête sont retirées : ce qui sert au
 * signalement, c'est la route, le code et l'heure. Un statut 0 (requête
 * jamais partie) s'affiche « réseau » plutôt qu'un zéro trompeur.
 */
export function formatErrorDetail(method: string, url: string, status: number, at: Date = new Date()): string {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url.split('?')[0];
  }

  const code = status > 0 ? String(status) : 'réseau';
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;

  return `${method.toUpperCase()} ${path} — ${code} · ${time}`;
}

/**
 * Bandeau d'erreur (`3d`) — le tableau reste en place, vide : on ne remplace
 * pas l'écran par une page d'erreur, le contexte de travail est conservé.
 * Le code technique est affiché et copiable, pour qu'un signalement soit
 * utilisable sans capture d'écran.
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './error-banner.component.html',
  styleUrl: './error-banner.component.scss',
})
export class ErrorBannerComponent {
  readonly title = input('Impossible de charger les données');
  readonly message = input("Le serveur n'a pas répondu. Vos saisies en cours sont conservées.");
  readonly detail = input('');

  readonly retry = output<void>();

  readonly copied = signal(false);

  async copyDetail(): Promise<void> {
    try {
      await navigator.clipboard?.writeText(this.detail());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Presse-papier refusé (contexte non sécurisé) : le détail reste
      // sélectionnable à la main, on n'affiche pas d'erreur par-dessus une erreur.
    }
  }
}
