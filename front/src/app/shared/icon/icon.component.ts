import { Component, computed, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Remplace les emoji par des icônes Lucide (https://lucide.dev), en trait,
 * sur currentColor — donc colorables par l'état actif du rail.
 *
 *   <app-icon name="sales" />
 *   <app-icon name="stock" [size]="16" />
 *
 * Les clés reprennent une à une les 17 emoji de DESIGN_SYSTEM.md.
 * Pour en ajouter une : copier le contenu de <svg> depuis lucide.dev
 * (viewBox 0 0 24 24, stroke-width 2) et l'ajouter à PATHS.
 */
const PATHS: Record<string, string> = {
  home:      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  sales:     '<path d="M3 3h7l11 11-7 7L3 10V3z"/><circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none"/>',
  service:   '<path d="M14.5 3.5a5 5 0 0 0-6.3 6.3L3 15v6h6l5.2-5.2a5 5 0 0 0 6.3-6.3l-3.2 3.2-3-3 3.2-3.2z"/>',
  purchases: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  cash:      '<path d="M3 6h18v12H3z"/><circle cx="12" cy="12" r="2.5"/>',
  stock:     '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
  inventory: '<path d="M5 3h14v18H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  brands:    '<path d="M4 20V8l8-4 8 4v12"/><path d="M4 20h16M10 20v-6h4v6"/>',
  parties:   '<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1.5c0-2.2 2.7-3.5 6-3.5s6 1.3 6 3.5V20"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M18 20v-1.5c0-1.5-.9-2.6-2.3-3.2"/>',
  client:    '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1.6c0-2.3 3.1-3.6 7-3.6s7 1.3 7 3.6V20"/>',
  supplier:  '<path d="M4 21V5h10v16M14 10h6v11"/><path d="M7 9h4M7 13h4M7 17h4"/>',
  carrier:   '<path d="M2 7h11v9H2zM13 10h5l3 3v3h-8"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  partner:   '<path d="M8 12 4 8l4-4 3 3h6l3 3-4 4"/><path d="M4 16h16"/>',
  finance:   '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 9.5V19h14V9.5M9 19v-6M15 19v-6M3 21h18"/>',
  bonus:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  payroll:   '<path d="M5 3h14v18H5z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
  reporting: '<path d="M4 20V9M10 20V4M16 20v-8M22 20H2"/>',
  users:     '<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1.5c0-2.2 2.7-3.5 6-3.5s6 1.3 6 3.5V20"/>',
  roles:     '<path d="M12 3 4 6v6c0 4.5 3.4 7.5 8 9 4.6-1.5 8-4.5 8-9V6l-8-3z"/>',
  activity:  '<path d="M3 12h4l2.5-6 3.5 12 2.5-6h5.5"/>',
  kpi:       '<path d="M4 18 9.5 11l4 3.5L20 6"/><path d="M15 6h5v5"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  search:    '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  view:      '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  edit:      '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
  delete:    '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  warning:   '<path d="M12 3 22 20H2L12 3z"/><path d="M12 9v5M12 17h.01"/>',
  pending:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  invoice:   '<path d="M4 3h16v18l-4-2-4 2-4-2-4 2z"/><path d="M8 8h8M8 12h8"/>',
  quote:     '<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h4"/>',
  logout:    '<path d="M15 4h4v16h-4"/><path d="M11 8l-4 4 4 4M7 12h9"/>',
  close:     '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron:   '<path d="m6 9 6 6 6-6"/>',

  // Ajouts : les emoji qui servaient encore d'icônes hors navigation.
  link:      '<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.5 4.4"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.5-1.5"/>',
  refresh:   '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  print:     '<path d="M7 8V3h10v5"/><path d="M5 8h14a2 2 0 0 1 2 2v6h-4"/><path d="M3 16V10a2 2 0 0 1 2-2"/><path d="M7 14h10v7H7z"/>',
  lock:      '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  download:  '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  check:     '<path d="m4 12 5 5 11-11"/>',
  calendar:  '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  phone:     '<path d="M4 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v4a16 16 0 0 1-16-16z"/>',
  location:  '<path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="square"
      stroke-linejoin="miter"
      aria-hidden="true"
      focusable="false"
      [innerHTML]="content()"
    ></svg>
  `,
  styles: [':host{display:inline-flex;line-height:0}svg{display:block}'],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);

  readonly content = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name()] ?? ''),
  );

  constructor(private sanitizer: DomSanitizer) {}
}
