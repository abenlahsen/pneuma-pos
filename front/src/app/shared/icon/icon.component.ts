import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

// Refonte 2b — remplacement des emoji par des icônes Lucide (SVG inline,
// aucune dépendance npm ajoutée). Tracés repris des prototypes de référence
// `design_handoff_refonte_2b/*.dc.html` quand ils y figurent, complétés par
// les tracés Lucide standards pour le reste du catalogue.
//
// stroke-linecap 'square' pour la navigation/les objets, 'round' pour les
// alertes et les signes (règle du handoff) — piloté par LINECAP ci-dessous.
const PATHS: Record<string, string> = {
  // Navigation / structure
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
  'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  'log-out': '<path d="M15 4h4v16h-4"/><path d="M11 8l-4 4 4 4M7 12h9"/>',

  // Recherche / fermeture / statut
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  close: '<path d="M5 5l14 14M19 5 5 19"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  circle: '<circle cx="12" cy="12" r="8.5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  'alert-triangle': '<path d="M12 3 22 20H2L12 3z"/><path d="M12 9v5M12 17h.01"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.2v.3"/>',

  // Actions de ligne
  view: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  link: '<path d="M9 15 15 9"/><path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5L16 11.5"/><path d="M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.3 6.4M3 12a9 9 0 0 1 15.3-6.4"/><path d="M21 3v6h-6M3 21v-6h6"/>',
  filter: '<path d="M3 4h18M6 12h12M10 19h4"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',
  print: '<path d="M6 9V4h12v5"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
  lock: '<path d="M6 11V8a6 6 0 0 1 12 0v3"/><path d="M5 11h14v9H5z"/>',
  unlock: '<path d="M6 11V8a6 6 0 0 1 11-3.6"/><path d="M5 11h14v9H5z"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  copy: '<path d="M6 6V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-2"/><path d="M4 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z"/>',

  // Métier
  tag: '<path d="M3 3h7l11 11-7 7L3 10V3z"/><circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none"/>',
  package: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  wrench: '<path d="M14.5 3.5a5 5 0 0 0-6.3 6.3L3 15v6h6l5.2-5.2a5 5 0 0 0 6.3-6.3l-3.2 3.2-3-3 3.2-3.2z"/>',
  'shopping-cart': '<path d="M3 4h3l2.5 11h10L21 7H7"/><circle cx="10" cy="19" r="1.4" fill="currentColor" stroke="none"/><circle cx="17.5" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
  building: '<path d="M4 21V3h10v18"/><path d="M14 9h6v12"/><path d="M7 7h1M11 7h1M7 11h1M11 11h1M7 15h1M11 15h1M17 13h1M17 17h1"/>',
  'building-2': '<path d="M3 4h18v16H3zM9 4v16M15 4v16"/>',
  truck: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 9.5V19h14V9.5M9 19v-6M15 19v-6M3 21h18"/>',
  handshake: '<path d="M8.5 14 4 9.5 8 5.5a3 3 0 0 1 4.2 0L14 7.3"/><path d="m10 12 2.3 2.3a1.7 1.7 0 0 0 2.4-2.4L12 9.2"/><path d="m14 8 1.7 1.7a1.7 1.7 0 0 0 2.4-2.4L15.8 5"/><path d="M16 10 20 5.5 16 3"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1.6c0-2.3 3.1-3.6 7-3.6s7 1.3 7 3.6V20"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1.5c0-2.2 2.7-3.5 6-3.5s6 1.3 6 3.5V20"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M18 20v-1.5c0-1.5-.9-2.6-2.3-3.2"/>',
  shield: '<path d="M12 3 22 7v6c0 5-4 8.5-10 9-6-.5-10-4-10-9V7z"/>',
  banknote: '<path d="M3 6h18v12H3z"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v6M18 9v6"/>',
  'credit-card': '<path d="M2 7h20v11H2zM2 11h20"/>',
  wallet: '<path d="M4 7h13a3 3 0 0 1 3 3v1h-5a2 2 0 0 0 0 4h5v1a3 3 0 0 1-3 3H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="15.5" cy="13" r="0.8" fill="currentColor" stroke="none"/>',
  coins: '<circle cx="8.5" cy="8.5" r="6"/><path d="M14 9.3a6 6 0 1 1-4.8-5.9"/>',
  receipt: '<path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L10 21l-2.5-1.7L5 21z"/><path d="M8 8h8M8 12h8"/>',
  calendar: '<path d="M8 2v4M16 2v4"/><path d="M3 4h18v18H3z"/><path d="M3 10h18"/>',
  phone: '<path d="M4 4h4l2 5-2.5 2A11 11 0 0 0 12.5 16.5L14.5 14l5 2v4a2 2 0 0 1-2 2C9.5 21.5 2.5 14.5 2.5 8a2 2 0 0 1 2-2z" fill="currentColor" stroke="none"/>',
  mail: '<path d="M3 5h18v14H3z"/><path d="m3 6 9 7 9-7"/>',
  'map-pin': '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/>',
  car: '<path d="M4 15V9.5l2.5-4h11l2.5 4V15"/><path d="M4 15h16v3H4z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  gauge: '<path d="M12 20a8 8 0 1 0-8-8"/><path d="M12 12 16 8"/><path d="M4 20h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  'trending-up': '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  'trending-down': '<path d="M22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/>',
  'bar-chart': '<path d="M4 20V9M10 20V4M16 20v-8M22 20H2"/>',
};

const LINECAP: Record<string, 'round' | 'square'> = {
  'alert-triangle': 'round',
  'alert-circle': 'round',
  'check-circle': 'round',
  'x-circle': 'round',
  check: 'round',
  close: 'round',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      [attr.stroke-width]="strokeWidth()"
      [attr.stroke-linecap]="linecap()"
      stroke-linejoin="round"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() ?? null"
      [innerHTML]="svgBody()"
    ></svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        color: inherit;
      }

      svg {
        stroke: currentColor;
        flex-shrink: 0;
      }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(16);
  readonly strokeWidth = input<number>(1.6);
  readonly label = input<string | undefined>(undefined);

  private readonly sanitizer = inject(DomSanitizer);

  protected readonly svgBody = computed<SafeHtml>(() => {
    // Noms fixes venus du code, jamais d'entrée utilisateur : contenu de confiance.
    const path = PATHS[this.name()] ?? '<circle cx="12" cy="12" r="9"/>';
    return this.sanitizer.bypassSecurityTrustHtml(path);
  });

  protected readonly linecap = computed(() => LINECAP[this.name()] ?? 'square');
}
