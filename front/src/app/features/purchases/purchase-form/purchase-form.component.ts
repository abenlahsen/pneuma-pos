import {
  Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PurchaseService } from '../data-access/purchase.service';
import { SupplierService } from '../../suppliers/data-access/supplier.service';
import { Supplier, SupplierProfileResponse } from '../../suppliers/models/supplier.model';
import {
  CatalogLot,
  CatalogPurchaseRef,
  Purchase,
  PurchaseCatalogProduct,
  PurchasePayload,
} from '../models/purchase.model';
import { PurchaseStatus } from '../../../core/constants/status.constants';

/** Une ligne d'achat, et ce que la saisie sait de son produit. */
export interface PurchaseLine {
  product_id: number;
  stock_id: number | null;
  quantity: number;
  unit_price: number;
  info: PurchaseCatalogProduct | null;
}

/** Ce que l'écran demande à la page. */
export interface PurchaseSaveRequest {
  payload: PurchasePayload;
  /** La réception choisie : l'API crée toujours en « En cours ». */
  reception: 'expected' | 'received';
  /** « Payé maintenant » : ouvrir l'encaissement après l'enregistrement. */
  payNow: boolean;
}

/** Au-delà de ce nombre de jours, un dû entre en risque légal (voir PurchaseService::OLD_DEBT_DAYS). */
const OLD_DEBT_DAYS = 90;

/**
 * La saisie d'achat en écran plein — refonte 2b, 12b, maquette 20b.
 *
 * Trois colonnes, comme la saisie de vente : la recherche à gauche (400 px),
 * les lignes au centre, le fournisseur, les documents, les totaux et le
 * règlement à droite (360 px). Les champs « Statut » et « Statut paiement »
 * ne sont plus des listes : la réception et le règlement sont deux choix
 * segmentés, là où ils ont un sens.
 *
 * Le prix saisi est comparé au dernier prix d'achat connu pendant la saisie,
 * pas une fois la facture enregistrée.
 */
@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './purchase-form.component.html',
  styleUrls: ['./purchase-form.component.scss'],
})
export class PurchaseFormComponent implements OnInit, OnDestroy {
  @Input() purchase: Purchase | null = null;
  @Input() busy = false;
  @Input() errorMessage: string | null = null;

  @Output() save = new EventEmitter<PurchaseSaveRequest>();
  @Output() cancel = new EventEmitter<void>();

  private readonly purchaseService = inject(PurchaseService);
  private readonly supplierService = inject(SupplierService);
  private readonly destroy$ = new Subject<void>();

  readonly suppliers = signal<Supplier[]>([]);
  readonly commercials = signal<{ id: number; name: string }[]>([]);

  // L'en-tête de l'achat
  readonly date = signal(new Date().toISOString().slice(0, 10));
  readonly supplierId = signal<number | null>(null);
  readonly commercialId = signal<number | null>(null);
  readonly withInvoice = signal(true);
  readonly blNumber = signal('');
  readonly invoiceNumber = signal('');
  readonly discount = signal(0);
  readonly reception = signal<'expected' | 'received'>('expected');
  readonly payNow = signal(false);

  readonly lines = signal<PurchaseLine[]>([]);

  // La recherche de gauche
  readonly query = signal('');
  readonly results = signal<PurchaseCatalogProduct[]>([]);
  readonly searching = signal(false);
  private readonly search$ = new Subject<{ q: string; supplier: number | null }>();

  // Le fournisseur choisi
  readonly supplierProfile = signal<SupplierProfileResponse | null>(null);

  // ── Dérivés ────────────────────────────────────────────────────────────

  readonly isEditing = computed(() => this.purchase !== null);

  /** Un achat terminé est reçu depuis longtemps : sa réception ne se choisit plus. */
  readonly receptionLocked = computed(() => this.purchase?.status === 'TERMINE' || this.purchase?.status === 'ANNULE');

  readonly supplier = computed(() => this.suppliers().find(s => s.id === this.supplierId()) ?? null);

  readonly totalQuantity = computed(() => this.lines().reduce((sum, l) => sum + (Number(l.quantity) || 0), 0));

  readonly linesTotal = computed(() =>
    Math.round(this.lines().reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0) * 100) / 100
  );

  readonly discountAmount = computed(() => Math.round(this.linesTotal() * (Number(this.discount()) || 0)) / 100);

  readonly netAmount = computed(() => Math.max(0, Math.round((this.linesTotal() - this.discountAmount()) * 100) / 100));

  readonly tyreCount = computed(() =>
    this.lines().filter(l => l.info?.type === 'tyre').reduce((sum, l) => sum + (Number(l.quantity) || 0), 0)
  );

  /** Ce que l'on doit déjà au fournisseur, sans compter l'achat que l'on modifie. */
  readonly alreadyDue = computed(() => {
    const profile = this.supplierProfile();
    if (!profile) return null;
    let due = Number(profile.outstanding_balance) || 0;
    if (this.purchase && this.purchase.supplier?.id === this.supplierId()) {
      const own = profile.purchases.find(p => p.id === this.purchase!.id);
      due -= Number(own?.outstanding_amount) || 0;
    }
    return Math.max(0, Math.round(due * 100) / 100);
  });

  /** Le total dû une fois cet achat enregistré. */
  readonly dueAfter = computed(() => {
    const due = this.alreadyDue();
    if (due === null) return null;
    const paid = this.purchase && this.purchase.supplier?.id === this.supplierId()
      ? Number(this.purchase.paid_amount) || 0
      : 0;
    return Math.round((due + Math.max(0, this.netAmount() - paid)) * 100) / 100;
  });

  readonly oldDebtCount = computed(() => {
    const profile = this.supplierProfile();
    if (!profile) return 0;
    const limit = Date.now() - OLD_DEBT_DAYS * 86_400_000;
    return profile.purchases.filter(p =>
      p.id !== this.purchase?.id
      && (Number(p.outstanding_amount) || 0) > 0.004
      && !!p.date && new Date(p.date).getTime() < limit
    ).length;
  });

  readonly termsDays = computed(() => this.supplier()?.payment_terms_days ?? null);

  /** L'échéance : la date de l'achat plus le délai contractuel du fournisseur. */
  readonly dueDate = computed(() => {
    const days = this.termsDays();
    if (days === null || days === undefined) return null;
    const d = new Date(this.date());
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().slice(0, 10);
  });

  readonly supplierResults = computed(() => this.results().filter(r => r.bought_from_supplier));
  readonly otherResults = computed(() => this.results().filter(r => !r.bought_from_supplier));

  readonly missingHint = computed(() => {
    if (!this.supplierId()) return 'Choisissez le fournisseur.';
    if (!this.lines().length) return 'Ajoutez au moins un produit.';
    if (this.lines().some(l => !l.stock_id)) return 'Chaque ligne doit avoir un dépôt de réception.';
    if (this.lines().some(l => !(Number(l.quantity) > 0))) return 'Chaque ligne doit avoir une quantité.';
    return '';
  });

  readonly canSave = computed(() => !this.missingHint());

  constructor() {
    // Le panneau fournisseur suit le fournisseur choisi.
    effect(() => {
      const id = this.supplierId();
      this.loadSupplierProfile(id);
    });
  }

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged((a, b) => a.q === b.q && a.supplier === b.supplier),
      switchMap(({ q, supplier }) => {
        if (!q.trim() && !supplier) {
          this.searching.set(false);
          return of({ data: [] as PurchaseCatalogProduct[] });
        }
        this.searching.set(true);
        return this.purchaseService.getCatalog({
          q: q.trim(),
          supplier_id: supplier,
          exclude_purchase_id: this.purchase?.id ?? null,
        }).pipe(
          catchError(() => of({ data: [] as PurchaseCatalogProduct[] })),
          finalize(() => this.searching.set(false)),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(res => this.results.set(res.data));

    forkJoin({
      suppliers: this.supplierService.getSuppliers({ all: true }).pipe(catchError(() => of([] as any))),
      filters: this.purchaseService.getFilters().pipe(catchError(() => of({ suppliers: [], commercials: [] }))),
    }).subscribe(({ suppliers, filters }) => {
      const list = Array.isArray(suppliers) ? suppliers : (suppliers as any)?.data ?? [];
      this.suppliers.set(list);
      this.commercials.set(filters.commercials ?? []);
    });

    if (this.purchase) this.loadPurchase(this.purchase);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPurchase(p: Purchase): void {
    this.date.set((p.date ?? '').slice(0, 10));
    this.supplierId.set(p.supplier?.id ?? null);
    this.commercialId.set(p.commercial?.id ?? null);
    this.withInvoice.set(!!p.with_invoice);
    this.blNumber.set(p.bl_number ?? '');
    this.invoiceNumber.set(p.invoice_number ?? '');
    this.discount.set(Number(p.discount) || 0);
    this.reception.set(p.status === 'EN COURS' ? 'expected' : 'received');

    const items = p.items ?? [];
    this.lines.set(items.map(it => ({
      product_id: it.product_id,
      stock_id: it.stock_id ?? null,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      info: null,
    })));

    // Les lignes existantes reçoivent leurs lots et leurs derniers prix — hors
    // cet achat, dont le prix n'est pas « le dernier connu ».
    const ids = [...new Set(items.map(it => it.product_id))];
    if (ids.length) {
      this.purchaseService.getCatalog({ ids, supplier_id: p.supplier?.id ?? null, exclude_purchase_id: p.id }).subscribe({
        next: (res) => {
          const byId = new Map(res.data.map(r => [r.id, r]));
          this.lines.update(lines => lines.map(l => ({ ...l, info: byId.get(l.product_id) ?? null })));
        },
      });
    }

    // Sans recherche, le volet montre ce qu'on achète d'habitude chez ce fournisseur.
    this.search$.next({ q: '', supplier: p.supplier?.id ?? null });
  }

  private loadSupplierProfile(id: number | null): void {
    this.supplierProfile.set(null);
    if (!id) return;
    this.supplierService.getSupplierProfile(id).subscribe({
      next: (profile) => this.supplierProfile.set(profile),
      error: () => this.supplierProfile.set(null),
    });
  }

  // ── La recherche ───────────────────────────────────────────────────────

  onQuery(value: string): void {
    this.query.set(value);
    this.search$.next({ q: value, supplier: this.supplierId() });
  }

  onSupplierChange(id: number | null): void {
    this.supplierId.set(id);
    this.search$.next({ q: this.query(), supplier: id });
    // Les derniers prix « chez ce fournisseur » des lignes déjà saisies changent.
    const ids = [...new Set(this.lines().map(l => l.product_id))];
    if (ids.length) {
      this.purchaseService.getCatalog({ ids, supplier_id: id, exclude_purchase_id: this.purchase?.id ?? null }).subscribe({
        next: (res) => {
          const byId = new Map(res.data.map(r => [r.id, r]));
          this.lines.update(lines => lines.map(l => ({ ...l, info: byId.get(l.product_id) ?? l.info })));
        },
      });
    }
  }

  isAdded(product: PurchaseCatalogProduct): boolean {
    return this.lines().some(l => l.product_id === product.id);
  }

  /**
   * Ajoute un produit. Le prix proposé est le dernier payé chez ce
   * fournisseur, à défaut le dernier payé tout court, à défaut le prix du
   * lot ; le lot proposé est le premier du produit.
   */
  addProduct(product: PurchaseCatalogProduct): void {
    const price = product.supplier_last_purchase?.unit_price
      ?? product.last_purchase?.unit_price
      ?? product.lots[0]?.purchase_price
      ?? 0;
    this.lines.update(lines => [...lines, {
      product_id: product.id,
      stock_id: product.lots[0]?.id ?? null,
      quantity: 1,
      unit_price: Number(price) || 0,
      info: product,
    }]);
  }

  updateLine(index: number, patch: Partial<PurchaseLine>): void {
    this.lines.update(lines => lines.map((l, i) => i === index ? { ...l, ...patch } : l));
  }

  removeLine(index: number): void {
    this.lines.update(lines => lines.filter((_, i) => i !== index));
  }

  // ── Lecture d'une ligne ────────────────────────────────────────────────

  productLabel(info: PurchaseCatalogProduct | null, fallbackId: number): string {
    if (!info) return `Produit #${fallbackId}`;
    return [info.brand, info.profile].filter(Boolean).join(' ') || info.reference || `Produit #${fallbackId}`;
  }

  lotLabel(lot: CatalogLot): string {
    const where = [lot.depot, lot.zone].filter(Boolean).join(' ') || `Lot ${lot.id}`;
    return lot.dot ? `${where} · DOT ${lot.dot}` : where;
  }

  lineTotal(line: PurchaseLine): number {
    return Math.round((Number(line.quantity) || 0) * (Number(line.unit_price) || 0) * 100) / 100;
  }

  /** La marge que laisse le prix d'achat saisi, au dernier prix de vente connu. */
  lineMarginPct(line: PurchaseLine): number | null {
    const sale = line.info?.last_sale_price;
    if (!sale || sale <= 0) return null;
    return ((sale - (Number(line.unit_price) || 0)) / sale) * 100;
  }

  /** Le dernier prix d'achat connu : c'est lui que la hausse compare. */
  lastKnown(line: PurchaseLine): CatalogPurchaseRef | null {
    return line.info?.last_purchase ?? null;
  }

  /**
   * La hausse, en pourcentage, du prix saisi sur le dernier prix d'achat
   * connu. `null` s'il n'y a pas de hausse, ou rien à quoi comparer.
   */
  priceRise(line: PurchaseLine): number | null {
    const last = this.lastKnown(line);
    const price = Number(line.unit_price) || 0;
    if (!last || last.unit_price <= 0 || price <= last.unit_price) return null;
    return ((price - last.unit_price) / last.unit_price) * 100;
  }

  /** « Prix supérieur de 2,2 % au dernier achat (812 DH le 14/05). » */
  priceRiseLabel(line: PurchaseLine): string {
    const rise = this.priceRise(line);
    const last = this.lastKnown(line);
    if (rise === null || !last) return '';
    const pct = rise.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    const [, m, d] = last.date.split('-');
    const elsewhere = last.supplier_id && last.supplier_id !== this.supplierId() && last.supplier_name
      ? ` chez ${last.supplier_name}` : '';
    return `Prix supérieur de ${pct} % au dernier achat (${this.money(last.unit_price)} DH le ${d}/${m}${elsewhere}).`;
  }

  money(value: number): string {
    return (Number(value) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }

  // ── Enregistrer ────────────────────────────────────────────────────────

  buildPayload(): PurchasePayload {
    let status: PurchaseStatus;
    if (this.purchase && this.receptionLocked()) {
      status = this.purchase.status;
    } else {
      status = this.reception() === 'received' ? 'RECU' : 'EN COURS';
    }

    return {
      date: this.date(),
      with_invoice: this.withInvoice(),
      bl_number: this.blNumber().trim() || null,
      invoice_number: this.withInvoice() ? (this.invoiceNumber().trim() || null) : null,
      discount: Number(this.discount()) || 0,
      supplier_id: this.supplierId() ?? 0,
      commercial_id: this.commercialId(),
      status,
      // Le statut de paiement est recalculé par l'API à partir des paiements.
      payment_status: this.purchase?.payment_status ?? 'NON PAYE',
      items: this.lines().map(l => ({
        product_id: l.product_id,
        stock_id: l.stock_id as number,
        quantity: Number(l.quantity) || 1,
        unit_price: Number(l.unit_price) || 0,
      })),
    };
  }

  onSubmit(): void {
    if (!this.canSave() || this.busy) return;
    this.save.emit({ payload: this.buildPayload(), reception: this.reception(), payNow: this.payNow() });
  }

  /** Le lien vers la création d'un produit : un nouvel onglet, l'achat reste ouvert. */
  openNewProduct(): void {
    window.open('/products/new', '_blank', 'noopener');
  }

  /** Un produit sans lot : on ouvre sa fiche, où le lot se crée. */
  openProduct(productId: number): void {
    window.open(`/products/${productId}/edit`, '_blank', 'noopener');
  }
}
