import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { Product, ProductPayload } from '../models/product.model';
import { Stock, StockPayload } from '../../../core/models/stock.model';
import { StockService } from '../../../core/services/stock.service';
import { StockMovementService } from '../../../core/services/stock-movement.service';
import { StockMovement, StockMovementType } from '../../../core/models/stock-movement.model';
import { AuthService } from '../../../core/services/auth.service';
import { formatTyreDimension, parseTyreDimension } from './tyre-dimension';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ConfirmDeleteComponent],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss'
})
export class ProductFormComponent implements OnInit {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  @Input() product: Product | null = null;
  @Input() brands: { id: number; name: string }[] = [];
  @Output() save = new EventEmitter<ProductPayload>();
  @Output() saveAndNew = new EventEmitter<ProductPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: ProductPayload = {
    profile: '',
    reference: '',
    type: 'tyre',
    brand_id: null,
    description: '',
    unit: 'piece',
    is_active: true,
    // Tyre-specific
    tire_width: null,
    tire_height: null,
    tire_diameter: null,
    tire_load_index: '',
    tire_speed_index: '',
    tire_season: null,
    tire_runflat: false,
    tire_reinforced: false,
    tire_marking: '',
    eu_fuel: null,
    eu_wet_grip: null,
    eu_noise_db: null,
    eu_noise_class: null,
    // Part-specific
    part_category: null,
    oem_reference: '',
    compatibility: '',
    // Service-specific
    service_category: null,
    duration_minutes: null,
    selling_price: null,
  };

  // ── Inventory ──
  stockItems = signal<Stock[]>([]);
  stockLoading = signal(false);
  showStockRow = signal(false);
  editingStockId = signal<number | null>(null);
  editingStockOriginalQty = signal<number | null>(null);
  editingStockQuantity = signal<number>(0);
  stockForm: Partial<StockPayload> = {};
  stockReason = signal<string>('');

  stockQuantityChanged = computed(() => {
    const orig = this.editingStockOriginalQty();
    if (orig === null) return false;
    return this.editingStockQuantity() !== orig;
  });


  // ── Dimension : un seul champ, analysé à la frappe (gabarit 15a) ──────────
  readonly dimensionInput = signal('');
  /** Ouvre les cinq champs d'origine quand l'analyse n'aboutit pas. */
  readonly dimensionManual = signal(false);

  readonly parsedDimension = computed(() => parseTyreDimension(this.dimensionInput()));

  /** Vide : ni reconnue ni fautive, on n'affiche rien. */
  readonly dimensionUnreadable = computed(
    () => this.dimensionInput().trim().length > 0 && this.parsedDimension() === null,
  );

  onDimensionInput(value: string): void {
    this.dimensionInput.set(value);

    const parsed = this.parsedDimension();
    if (!parsed) return;

    // L'analyse n'écrit que lorsqu'elle aboutit : une saisie en cours ne doit
    // pas effacer une dimension déjà enregistrée.
    this.formData.tire_width = parsed.width;
    this.formData.tire_height = parsed.height;
    this.formData.tire_diameter = parsed.diameter;
    if (parsed.loadIndex) this.formData.tire_load_index = parsed.loadIndex;
    if (parsed.speedIndex) this.formData.tire_speed_index = parsed.speedIndex;
  }

  /** Après une saisie champ par champ, le champ unique se resynchronise. */
  syncDimensionFromFields(): void {
    this.dimensionInput.set(
      formatTyreDimension(
        this.formData.tire_width ?? null,
        this.formData.tire_height ?? null,
        this.formData.tire_diameter ?? null,
        this.formData.tire_load_index,
        this.formData.tire_speed_index,
      ),
    );
  }

  // ── Type en choix segmenté (gabarit 15a) ─────────────────────────────────
  /**
   * Le changement de type ne vide aucun champ : les valeurs de l'autre type
   * restent dans le formulaire et le serveur ignore celles qui ne concernent
   * pas le type retenu. Un aller-retour par erreur entre « Pneu » et
   * « Service » ne doit pas coûter une dimension ressaisie.
   */
  selectType(type: 'tyre' | 'part' | 'service'): void {
    this.formData.type = type;
  }

  // ── Motif de changement de quantité : quatre boutons + une précision ──────
  readonly REASON_PRESETS = ['Inventaire', 'Casse', 'Transfert', 'Retour'];
  readonly reasonPreset = signal('');
  readonly reasonDetail = signal('');

  selectReasonPreset(preset: string): void {
    this.reasonPreset.set(preset);
    this.composeReason();
  }

  onReasonDetail(value: string): void {
    this.reasonDetail.set(value);
    this.composeReason();
  }

  /**
   * Le serveur attend une chaîne d'au moins trois caractères. Un bouton seul
   * la fournit ; la précision libre s'y ajoute quand elle existe.
   */
  private composeReason(): void {
    const preset = this.reasonPreset();
    const detail = this.reasonDetail().trim();
    this.stockReason.set([preset, detail].filter(Boolean).join(' · '));
  }

  // ── Stock Movements History ──
  movements = signal<StockMovement[]>([]);
  movementsLoading = signal(false);
  showMovements = signal(false);

  constructor(
    private stockService: StockService,
    private stockMovementService: StockMovementService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    if (this.product) {
      const tyre = this.product.tyre ?? null;
      const part = this.product.part ?? null;
      const service = this.product.service ?? null;

      this.formData = {
        profile: this.product.profile || '',
        reference: this.product.reference || '',
        type: this.product.type,
        brand_id: this.product.brand_id,
        description: this.product.description || '',
        unit: this.product.unit || 'piece',
        is_active: this.product.is_active,
        // Tyre-specific
        tire_width: tyre?.tire_width ?? null,
        tire_height: tyre?.tire_height ?? null,
        tire_diameter: tyre?.tire_diameter ?? null,
        tire_load_index: tyre?.tire_load_index || '',
        tire_speed_index: tyre?.tire_speed_index || '',
        tire_season: tyre?.tire_season ?? null,
        tire_runflat: tyre?.tire_runflat ?? false,
        tire_reinforced: tyre?.tire_reinforced ?? false,
        tire_marking: tyre?.tire_marking || '',
        eu_fuel: tyre?.eu_fuel ?? null,
        eu_wet_grip: tyre?.eu_wet_grip ?? null,
        eu_noise_db: tyre?.eu_noise_db ?? null,
        eu_noise_class: tyre?.eu_noise_class ?? null,
        // Part-specific
        part_category: part?.category ?? null,
        oem_reference: part?.oem_reference || '',
        compatibility: part?.compatibility || '',
        // Service-specific
        service_category: service?.category ?? null,
        duration_minutes: service?.duration_minutes ?? null,
        selling_price: service?.selling_price ?? null,
      };

      this.syncDimensionFromFields();

      // Services have no stock
      if (this.product.type !== 'service') {
        this.loadStock();
      }
    }
  }

  get isTyre(): boolean {
    return this.formData.type === 'tyre';
  }

  get isPart(): boolean {
    return this.formData.type === 'part';
  }

  get isService(): boolean {
    return this.formData.type === 'service';
  }

  get isEditing(): boolean {
    return !!this.product;
  }

  get totalStock(): number {
    return this.stockItems().reduce((sum, s) => sum + s.quantity, 0);
  }

  onSubmit() {
    this.save.emit(this.formData);
  }

  onSubmitAndNew() {
    this.saveAndNew.emit(this.formData);
  }

  /**
   * Le pied annonce les champs réellement exigés, qui dépendent du type. Le
   * gabarit listait « type, marque, dimension » ; la marque n'est pas requise
   * par le serveur et l'annoncer serait une promesse fausse.
   */
  get requiredHint(): string {
    if (this.isPart) return 'Champs requis : type, catégorie.';
    if (this.isService) return 'Champs requis : type, nom du service, catégorie.';

    return 'Champ requis : type. La dimension reste vivement conseillée.';
  }

  /** Dernière modification connue du serveur, pour la barre haute. */
  get lastModified(): string | null {
    return this.product?.updated_at ?? null;
  }

  // ── Stock Management ──

  loadStock(): void {
    if (!this.product) return;
    this.stockLoading.set(true);
    this.stockService.getStocks({ product_id: this.product.id.toString(), per_page: '200' }).subscribe({
      next: (response) => {
        this.stockItems.set(response.data);
        this.stockLoading.set(false);
      },
      error: () => this.stockLoading.set(false),
    });
  }

  openAddStock(): void {
    this.editingStockId.set(null);
    this.editingStockOriginalQty.set(null);
    this.stockReason.set('');
    this.stockForm = {
      product_id: this.product!.id,
      depot: '',
      zone: '',
      made_in: '',
      dot: '',
      quantity: 0,
      purchase_price: null,
    };
    this.showStockRow.set(true);
  }

  editStock(stock: Stock): void {
    this.editingStockId.set(stock.id);
    this.editingStockOriginalQty.set(stock.quantity);
    this.editingStockQuantity.set(stock.quantity);
    this.stockReason.set('');
    this.stockForm = {
      product_id: this.product!.id,
      depot: stock.depot || '',
      zone: stock.zone || '',
      made_in: stock.made_in || '',
      dot: stock.dot || '',
      quantity: stock.quantity,
      purchase_price: stock.purchase_price,
    };
    this.showStockRow.set(true);
  }

  cancelStockEdit(): void {
    this.reasonPreset.set('');
    this.reasonDetail.set('');
    this.showStockRow.set(false);
    this.editingStockId.set(null);
    this.editingStockOriginalQty.set(null);
    this.editingStockQuantity.set(0);
    this.stockReason.set('');
    this.stockForm = {};
  }

  saveStock(): void {
    // Block save if editing and qty changed without reason
    if (this.stockQuantityChanged() && this.stockReason().trim().length < 3) {
      alert('Veuillez saisir un motif (au moins 3 caractères) pour justifier le changement de quantité.');
      return;
    }

    const payload: StockPayload = {
      product_id: this.product!.id,
      depot: (this.stockForm.depot as string) || null,
      zone: (this.stockForm.zone as string) || null,
      made_in: (this.stockForm.made_in as string) || null,
      dot: (this.stockForm.dot as string) || null,
      quantity: this.editingStockId() !== null ? this.editingStockQuantity() : (this.stockForm.quantity || 0),
      purchase_price: this.stockForm.purchase_price ?? null,
    };

    if (this.stockQuantityChanged()) {
      payload.reason = this.stockReason().trim();
    }

    const editId = this.editingStockId();
    if (editId) {
      this.stockService.updateStock(editId, payload).subscribe({
        next: () => { this.cancelStockEdit(); this.loadStock(); this.loadMovementsIfOpen(); },
      });
    } else {
      this.stockService.createStock(payload).subscribe({
        next: () => { this.cancelStockEdit(); this.loadStock(); this.loadMovementsIfOpen(); },
      });
    }
  }

  deleteStock(stock: Stock): void {
    this.pendingDelete.set({
      title: `Supprimer le lot ${stock.depot || 'sans dépôt'}${stock.zone ? ' · ' + stock.zone : ''} ?`,
      consequence: `${stock.quantity} ${stock.quantity > 1 ? 'articles sortiront' : 'article sortira'} du stock.`,
      detail: 'Un mouvement de type Suppression sera écrit dans l\'historique, avec votre nom.',
      run: () => {
        this.stockService.deleteStock(stock.id).subscribe({
          next: () => { this.loadStock(); this.loadMovementsIfOpen(); },
        });
      },
    });
  }

  // ── Stock Movements ──

  toggleMovements(): void {
    const next = !this.showMovements();
    this.showMovements.set(next);
    if (next && this.movements().length === 0) {
      this.loadMovements();
    }
  }

  loadMovements(): void {
    if (!this.product) return;
    this.movementsLoading.set(true);
    this.stockMovementService.getMovements({ product_id: this.product.id, per_page: 100 }).subscribe({
      next: (res) => {
        this.movements.set(res.data);
        this.movementsLoading.set(false);
      },
      error: () => this.movementsLoading.set(false),
    });
  }

  private loadMovementsIfOpen(): void {
    if (this.showMovements()) {
      this.loadMovements();
    }
  }

  movementTypeLabel(type: StockMovementType): string {
    const labels: Record<StockMovementType, string> = {
      AUTO_CREATE: 'Création produit',
      INITIAL: 'Création initiale',
      IMPORT: 'Import Excel',
      ADJUSTMENT: 'Ajustement',
      DELETION: 'Suppression',
      SALE_OUT: 'Vente',
      SALE_IN: 'Annulation vente',
      PURCHASE_IN: 'Achat',
      PURCHASE_OUT: 'Annulation achat',
    };
    return labels[type] || type;
  }

  movementTypeClass(type: StockMovementType): string {
    const classes: Record<StockMovementType, string> = {
      AUTO_CREATE: 'mv-grey',
      INITIAL: 'mv-grey',
      IMPORT: 'mv-blue',
      ADJUSTMENT: 'mv-orange',
      DELETION: 'mv-dark-red',
      SALE_OUT: 'mv-red',
      SALE_IN: 'mv-green',
      PURCHASE_IN: 'mv-green',
      PURCHASE_OUT: 'mv-red',
    };
    return classes[type] || '';
  }

  movementReferenceLabel(m: StockMovement): string {
    if (!m.reference_type) return '-';
    if (m.reference_type.endsWith('Sale')) return `Vente #${m.reference_id}`;
    if (m.reference_type.endsWith('Purchase')) return `Achat #${m.reference_id}`;
    if (m.reference_type === 'Import') return 'Import';
    return m.reference_type;
  }
}
