import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product, ProductPayload } from '../../../core/models/product.model';
import { Stock, StockPayload } from '../../../core/models/stock.model';
import { StockService } from '../../../core/services/stock.service';
import { StockMovementService } from '../../../core/services/stock-movement.service';
import { StockMovement, StockMovementType } from '../../../core/models/stock-movement.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-form.component.html',
  styleUrls: ['../../sales/sale-form/sale-form.component.scss', './product-form.component.scss']
})
export class ProductFormComponent implements OnInit {
  @Input() product: Product | null = null;
  @Input() brands: { id: number; name: string }[] = [];
  @Output() save = new EventEmitter<ProductPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: ProductPayload = {
    profile: '',
    reference: '',
    type: 'tyre',
    brand_id: null,
    description: '',
    unit: 'piece',
    is_active: true,
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
  };

  // ── Inventory ──
  stockItems = signal<Stock[]>([]);
  stockLoading = signal(false);
  showStockRow = signal(false);
  editingStockId = signal<number | null>(null);
  editingStockOriginalQty = signal<number | null>(null);
  stockForm: Partial<StockPayload> = {};
  stockReason = signal<string>('');

  stockQuantityChanged = computed(() => {
    const orig = this.editingStockOriginalQty();
    if (orig === null) return false;
    return Number(this.stockForm.quantity ?? 0) !== orig;
  });

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
      this.formData = {
        profile: this.product.profile || '',
        reference: this.product.reference || '',
        type: this.product.type,
        brand_id: this.product.brand_id,
        description: this.product.description || '',
        unit: this.product.unit || 'piece',
        is_active: this.product.is_active,
        tire_width: this.product.tire_width,
        tire_height: this.product.tire_height,
        tire_diameter: this.product.tire_diameter,
        tire_load_index: this.product.tire_load_index || '',
        tire_speed_index: this.product.tire_speed_index || '',
        tire_season: this.product.tire_season,
        tire_runflat: this.product.tire_runflat,
        tire_reinforced: this.product.tire_reinforced,
        tire_marking: this.product.tire_marking || '',
        eu_fuel: this.product.eu_fuel,
        eu_wet_grip: this.product.eu_wet_grip,
        eu_noise_db: this.product.eu_noise_db,
        eu_noise_class: this.product.eu_noise_class,
      };
      this.loadStock();
    }
  }

  get isTyre(): boolean {
    return this.formData.type === 'tyre';
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
    this.showStockRow.set(false);
    this.editingStockId.set(null);
    this.editingStockOriginalQty.set(null);
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
      quantity: this.stockForm.quantity || 0,
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
    if (confirm(`Supprimer cette entrée stock (Qté: ${stock.quantity}, Dépôt: ${stock.depot || '-'}) ?`)) {
      this.stockService.deleteStock(stock.id).subscribe({
        next: () => { this.loadStock(); this.loadMovementsIfOpen(); },
      });
    }
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
