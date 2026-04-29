import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../models/product.model';
import { Stock } from '../../../core/models/stock.model';
import { StockMovement, StockMovementType } from '../../../core/models/stock-movement.model';
import { StockService } from '../../../core/services/stock.service';
import { StockMovementService } from '../../../core/services/stock-movement.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit {
  @Input({ required: true }) product!: Product;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Product>();

  stockItems = signal<Stock[]>([]);
  stockLoading = signal(false);
  movements = signal<StockMovement[]>([]);
  movementsLoading = signal(false);
  showMovements = signal(false);

  constructor(
    private stockService: StockService,
    private stockMovementService: StockMovementService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    if (this.product.type !== 'service') {
      this.loadStock();
    }
  }

  get isTyre(): boolean { return this.product?.type === 'tyre'; }
  get isPart(): boolean { return this.product?.type === 'part'; }
  get isService(): boolean { return this.product?.type === 'service'; }

  get totalStock(): number {
    return this.stockItems().reduce((sum, s) => sum + s.quantity, 0);
  }

  loadStock(): void {
    this.stockLoading.set(true);
    this.stockService.getStocks({ product_id: this.product.id.toString(), per_page: '200' }).subscribe({
      next: (res) => { this.stockItems.set(res.data); this.stockLoading.set(false); },
      error: () => this.stockLoading.set(false),
    });
  }

  toggleMovements(): void {
    const next = !this.showMovements();
    this.showMovements.set(next);
    if (next && this.movements().length === 0) {
      this.loadMovements();
    }
  }

  loadMovements(): void {
    this.movementsLoading.set(true);
    this.stockMovementService.getMovements({ product_id: this.product.id, per_page: 100 }).subscribe({
      next: (res) => { this.movements.set(res.data); this.movementsLoading.set(false); },
      error: () => this.movementsLoading.set(false),
    });
  }

  typeLabel(): string {
    switch (this.product?.type) {
      case 'tyre': return 'Pneu';
      case 'part': return 'Pièce';
      case 'service': return 'Service';
      default: return this.product?.type || '-';
    }
  }

  seasonLabel(): string {
    switch (this.product?.tyre?.tire_season) {
      case 'summer': return 'Été';
      case 'winter': return 'Hiver';
      case 'all_season': return '4 Saisons';
      default: return '-';
    }
  }

  partCategoryLabel(): string {
    switch (this.product?.part?.category) {
      case 'brakes': return 'Freinage';
      case 'lubricants': return 'Lubrifiants';
      case 'engine': return 'Moteur';
      case 'suspension': return 'Suspension';
      case 'filters': return 'Filtres';
      case 'electrical': return 'Électrique';
      case 'body': return 'Carrosserie';
      case 'other': return 'Autre';
      default: return this.product?.part?.category || '-';
    }
  }

  serviceCategoryLabel(): string {
    switch (this.product?.service?.category) {
      case 'mechanical': return 'Mécanique';
      case 'oil': return 'Vidange / Huile';
      case 'tires': return 'Pneumatique';
      case 'bodywork': return 'Carrosserie';
      case 'diagnostic': return 'Diagnostic';
      case 'other': return 'Autre';
      default: return this.product?.service?.category || '-';
    }
  }

  unitLabel(): string {
    switch (this.product?.unit) {
      case 'piece': return 'Pièce';
      case 'set': return 'Jeu';
      case 'pair': return 'Paire';
      case 'meter': return 'Mètre';
      case 'liter': return 'Litre';
      default: return this.product?.unit || '-';
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
