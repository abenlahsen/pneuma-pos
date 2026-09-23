import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  afterRenderEffect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PrintService } from '../../../core/services/print.service';
import { CompanySettings } from '../../settings/models/company-settings.model';
import { ShipmentChangeService } from '../data-access/shipment-change.service';
import {
  SHIPMENT_CHANGE_FIELD_LABELS,
  ShipmentChangeItem,
  ShipmentChangeRequest,
} from '../models/shipment-change.model';

import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';

/**
 * La lettre au transporteur — refonte 2b, 9d, maquette 18c.
 *
 * Elle part par fax, par photo WhatsApp ou en impression noir et blanc :
 * aucune couleur d'interface sur la feuille, seulement l'encre, des gris et le
 * logo. Le transporteur cherche une seule chose — quel colis, et quoi changer —
 * d'où un numéro d'expédition qui domine la page et un avant / après où
 * l'ancienne valeur est barrée et la nouvelle en gras.
 *
 * L'aperçu a quitté la modale : il vit sur `/shipment-changes/:id/print`, ce
 * qui rend le document adressable et lui donne une vraie barre d'actions.
 */
@Component({
  selector: 'app-shipment-change-print-page',
  standalone: true,
  imports: [CommonModule, IconComponent, ListErrorComponent],
  templateUrl: './shipment-change-print-page.component.html',
  styleUrl: './shipment-change-print-page.component.scss',
})
export class ShipmentChangePrintPageComponent implements OnInit {
  @ViewChild('printZone', { static: false }) printZoneRef?: ElementRef<HTMLElement>;

  private readonly printService = inject(PrintService);
  private readonly service = inject(ShipmentChangeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly request = signal<ShipmentChangeRequest | null>(null);
  readonly settings = signal<CompanySettings | null>(null);
  readonly loading = signal(true);
  readonly generatingPdf = signal(false);

  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);

  /**
   * Le logo n'a pas pu être chargé. `logo_url` est construite à partir du
   * chemin enregistré, sans vérifier que le fichier existe : une image
   * supprimée du stockage donne une URL valide et un trou à l'écran. Sur une
   * lettre envoyée à un tiers, ce trou est en haut à gauche, à l'endroit
   * exact où l'on identifie l'expéditeur.
   *
   * On retombe alors sur le nom de l'entreprise en toutes lettres.
   */
  readonly logoFailed = signal(false);

  /** Vrai seulement si une image est annoncée ET qu'elle s'est chargée. */
  showLogo(): boolean {
    return !!this.settings()?.logo_url && !this.logoFailed();
  }

  // ── Le dépassement d'une page ──────────────────────────────────────────────
  //
  // La feuille est de hauteur fixe et `overflow: hidden` — c'est ce qui garantit
  // « une page, jamais deux ». Mais ce qui dépasse est alors coupé en silence,
  // et ce sont les signatures et les mentions légales qui partent en premier,
  // puisqu'elles sont en bas. Une lettre sans signature ne revient pas signée du
  // transporteur et ne vaut rien comme preuve : on constate le dépassement au
  // lieu de l'espérer.

  readonly overflows = signal(false);

  /**
   * `afterRenderEffect` couvre les deux moments : une fois la feuille rendue,
   * puis à chaque fois que ce qu'elle contient change. C'est le premier
   * composant de l'application à mesurer son propre DOM — il n'y a donc pas
   * d'autre exemple à côté duquel se ranger.
   *
   * Il ne boucle pas : `overflows` est écrit dans ce rappel, jamais lu.
   */
  private readonly watchOverflow = afterRenderEffect(() => {
    // Les paramètres sont une dépendance au même titre que la demande : ils
    // arrivent par un second appel et remplissent l'en-tête « De » ainsi que
    // les mentions légales, donc ils changent la hauteur après coup.
    this.request();
    this.settings();
    this.measureOverflow();
  });

  /**
   * Publique parce que le test la rappelle après avoir simulé la géométrie :
   * jsdom ne calcule aucune mise en page.
   */
  measureOverflow(): void {
    const zone = this.printZoneRef?.nativeElement;
    // Une tolérance d'un pixel : un arrondi sous-pixel n'est pas un dépassement.
    this.overflows.set(!!zone && zone.scrollHeight > zone.clientHeight + 1);
  }

  ngOnInit(): void {
    this.printService.getSettings().subscribe({
      next: (s) => this.settings.set(s),
      error: () => {},
    });

    this.route.paramMap.subscribe((params) => this.load(Number(params.get('id'))));
  }

  load(id: number): void {
    if (!id) return;
    this.loading.set(true);
    this.service.get(id).subscribe({
      next: (req) => {
        this.request.set(req);
        this.loading.set(false);
        this.loadError.set(null);
      },
      error: (err) => {
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
      },
    });
  }

  reload(): void {
    const req = this.request();
    this.load(req?.id ?? Number(this.route.snapshot.paramMap.get('id')));
  }

  back(): void {
    const saleId = this.request()?.sale_id;
    // Retour à la vente d'où la demande est partie ; à défaut, à la liste.
    this.router.navigate(saleId ? ['/ventes', saleId] : ['/ventes']);
  }

  // ── Les deux champs que 18c ajoute ─────────────────────────────────────────

  /**
   * Méthodes et non `computed()` : ces deux dérivations sont lues une fois par
   * rendu, et une méthode se teste sans contexte d'injection — ce composant
   * utilise `inject()` dans ses champs, donc un `computed()` de champ n'existe
   * pas sur une instance créée sans TestBed.
   */

  /** Le nombre de colis : la quantité totale de la vente. */
  parcelCount(): number | null {
    return this.request()?.sale?.total_quantity ?? null;
  }

  /** Le signataire, avec sa fonction. */
  signatory(): string | null {
    const creator = this.request()?.creator;
    if (!creator) return null;
    return creator.role ? `${creator.name} · ${creator.role.toLowerCase()}` : creator.name;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async downloadPdf(): Promise<void> {
    const zone = this.printZoneRef?.nativeElement;
    if (this.generatingPdf() || !zone) return;
    // html2canvas capture l'élément TEL QU'IL EST RENDU, donc déjà rogné par
    // `overflow: hidden` : le PDF serait amputé exactement comme la feuille.
    if (this.overflows()) return;

    this.generatingPdf.set(true);
    try {
      await this.printService.downloadPdf(zone, `demande-modification-${this.filenameSuffix()}`);
    } finally {
      this.generatingPdf.set(false);
    }
  }

  print(): void {
    if (this.overflows()) return;
    window.print();
  }

  private filenameSuffix(): string {
    const request = this.request();
    if (!request) return 'document';

    const shipmentNumber = request.shipment_number?.trim();
    return shipmentNumber ? shipmentNumber.replace(/[^a-zA-Z0-9-_]+/g, '-') : String(request.id);
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  fieldLabel(item: ShipmentChangeItem): string {
    if (item.field === 'other') {
      return item.custom_label || SHIPMENT_CHANGE_FIELD_LABELS.other;
    }
    return SHIPMENT_CHANGE_FIELD_LABELS[item.field];
  }

  /** `DM-2026-0142` — la référence que porte l'en-tête. */
  reference(request: ShipmentChangeRequest): string {
    const year = (request.date ?? '').slice(0, 4) || String(new Date().getFullYear());
    return `DM-${year}-${String(request.id).padStart(4, '0')}`;
  }

  fmtDate(value: string | null | undefined): string {
    if (!value) return '—';
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  /** « Casablanca, le 17/09/2026 » — la mention de lieu et date de la lettre. */
  placeAndDate(request: ShipmentChangeRequest): string {
    const city = this.settings()?.city;
    const date = this.fmtDate(request.date);
    return city ? `${city}, le ${date}` : `Le ${date}`;
  }
}
