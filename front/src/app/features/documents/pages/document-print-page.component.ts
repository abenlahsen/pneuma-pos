import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PrintService } from '../../../core/services/print.service';
import { CompanySettings } from '../../settings/models/company-settings.model';
import { SaleService } from '../../sales/data-access/sale.service';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ServiceOrderService } from '../../service-orders/data-access/service-order.service';
import {
  DocumentPrintComponent,
  DocumentType,
  PrintDocument,
} from '../../../shared/document-print/document-print.component';
import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';
import { buildPurchasePrint, buildSalePrint, buildServiceOrderPrint } from '../print-builders';
import { isDocumentType } from '../document-types';

/**
 * L'imprimé de vente, d'achat et d'intervention — refonte 2b, étape 10.
 *
 * L'aperçu a quitté sa modale, comme la lettre au transporteur : il vit sur
 * `/documents/:type/:id/print`. Le document devient adressable, se recharge
 * seul depuis l'API, et gagne une vraie barre d'actions — Imprimer et
 * Télécharger PDF.
 */
@Component({
  selector: 'app-document-print-page',
  standalone: true,
  imports: [CommonModule, IconComponent, ListErrorComponent, DocumentPrintComponent],
  templateUrl: './document-print-page.component.html',
  styleUrl: './document-print-page.component.scss',
})
export class DocumentPrintPageComponent implements OnInit {
  @ViewChild('sheet', { static: false }) sheetRef?: ElementRef<HTMLElement>;

  private readonly printService = inject(PrintService);
  private readonly sales = inject(SaleService);
  private readonly purchases = inject(PurchaseService);
  private readonly serviceOrders = inject(ServiceOrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly type = signal<DocumentType | null>(null);
  readonly id = signal<number | null>(null);
  readonly document = signal<PrintDocument | null>(null);
  readonly settings = signal<CompanySettings | null>(null);
  /**
   * Les paramètres portent l'émetteur, la ville, le taux de TVA et les
   * mentions légales. Ils arrivent par un appel distinct, parfois après la
   * vente : imprimer avant, c'est sortir une facture sans émetteur ni TVA.
   * Vrai aussi en cas d'échec — on imprime alors sans eux, en connaissance
   * de cause, plutôt que de bloquer.
   */
  readonly settingsReady = signal(false);
  readonly loading = signal(true);
  readonly generatingPdf = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);

  ngOnInit(): void {
    this.printService.getSettings().subscribe({
      next: (s) => { this.settings.set(s); this.settingsReady.set(true); },
      error: () => this.settingsReady.set(true),
    });

    this.route.paramMap.subscribe((params) => {
      const type = params.get('type');
      const id = Number(params.get('id'));
      if (!isDocumentType(type) || !id) {
        this.router.navigate(['/dashboard']);
        return;
      }
      this.type.set(type);
      this.id.set(id);
      this.load();
    });
  }

  /** L'entité, relue par son `show`, puis mise en forme par son constructeur. */
  private fetch(type: DocumentType, id: number): Observable<PrintDocument> {
    switch (type) {
      case 'sale':
        return this.sales.getSale(id).pipe(map(buildSalePrint));
      case 'purchase':
        return this.purchases.getPurchase(id).pipe(map(buildPurchasePrint));
      case 'service_order':
        return this.serviceOrders.getServiceOrder(id).pipe(map(buildServiceOrderPrint));
    }
  }

  load(): void {
    const type = this.type();
    const id = this.id();
    if (!type || !id) return;

    this.loading.set(true);
    this.fetch(type, id).subscribe({
      next: (doc) => {
        this.document.set(doc);
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

  /**
   * Retour à l'écran d'où l'on vient — la liste avec sa modale, ou la fiche.
   * Sans historique dans l'application (lien ouvert directement), on va à la
   * fiche de l'entité, ou à sa liste quand elle n'a pas de page propre.
   */
  back(): void {
    const previous = this.router.lastSuccessfulNavigation()?.previousNavigation;
    if (previous) {
      this.location.back();
      return;
    }
    const id = this.id();
    switch (this.type()) {
      case 'sale': this.router.navigate(['/sales', id]); break;
      case 'purchase': this.router.navigate(['/achats', id]); break;
      default: this.router.navigate(['/service-orders']);
    }
  }

  /** Le document et ses paramètres sont là : la feuille est complète. */
  canOutput(): boolean {
    return !!this.document() && this.settingsReady();
  }

  print(): void {
    if (!this.canOutput()) return;
    window.print();
  }

  async downloadPdf(): Promise<void> {
    const sheet = this.sheetRef?.nativeElement;
    if (this.generatingPdf() || !sheet || !this.canOutput()) return;

    this.generatingPdf.set(true);
    try {
      await this.printService.downloadDocumentPdf(sheet, this.filename());
    } finally {
      this.generatingPdf.set(false);
    }
  }

  /** `facture-4182`, `bon-d-achat-88`, `fiche-d-intervention-12`. */
  filename(): string {
    const doc = this.document();
    if (!doc) return 'document';
    const slug = doc.title
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${slug}-${this.id()}`;
  }
}
