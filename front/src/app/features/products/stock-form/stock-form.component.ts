import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Stock, StockPayload } from '../../../core/models/stock.model';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';

@Component({
  selector: 'app-stock-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-form.component.html',
  styleUrls: ['../../sales/sale-form/sale-form.component.scss', './stock-form.component.scss']
})
export class StockFormComponent implements OnInit {
  @Input() stock: Stock | null = null;
  @Output() save = new EventEmitter<StockPayload>();
  @Output() cancel = new EventEmitter<void>();

  products = signal<Product[]>([]);
  productSearch = signal('');
  loadingProducts = signal(false);

  // Track original quantity to detect changes and require a reason
  private originalQuantity = signal<number | null>(null);
  currentQuantity = signal<number>(0);
  reason = signal<string>('');

  isEditing = computed(() => this.originalQuantity() !== null);
  quantityChanged = computed(() =>
    this.isEditing() && this.currentQuantity() !== this.originalQuantity()
  );
  reasonRequired = computed(() => this.quantityChanged());

  formData: StockPayload = {
    product_id: 0,
    made_in: '',
    dot: '',
    depot: '',
    zone: '',
    quantity: 0,
    purchase_price: null,
  };

  constructor(private productService: ProductService) {}

  private editingProduct: Product | null = null;

  ngOnInit() {
    if (this.stock) {
      this.formData = {
        product_id: this.stock.product_id || 0,
        made_in: this.stock.made_in || '',
        dot: this.stock.dot || '',
        depot: this.stock.depot || '',
        zone: this.stock.zone || '',
        quantity: this.stock.quantity,
        purchase_price: this.stock.purchase_price,
      };
      this.originalQuantity.set(this.stock.quantity);
      this.currentQuantity.set(this.stock.quantity);
      if (this.stock.product) {
        this.editingProduct = this.stock.product;
        this.products.set([this.stock.product]);
      }
    }
    this.searchProducts();
  }

  onQuantityChange(value: number | string): void {
    const n = typeof value === 'string' ? parseInt(value, 10) : value;
    this.formData.quantity = Number.isFinite(n) ? n : 0;
    this.currentQuantity.set(this.formData.quantity);
  }

  searchProducts(): void {
    this.loadingProducts.set(true);
    const filters: Record<string, string> = { per_page: '50', is_active: '1' };
    if (this.productSearch()) {
      filters['search'] = this.productSearch();
    }
    this.productService.getProducts(filters).subscribe({
      next: (res) => {
        let list = res.data;
        // Ensure the currently selected product is always in the list
        if (this.editingProduct && !list.find(p => p.id === this.editingProduct!.id)) {
          list = [this.editingProduct, ...list];
        }
        this.products.set(list);
        this.loadingProducts.set(false);
      },
      error: () => this.loadingProducts.set(false),
    });
  }

  onProductSelected(event: Event): void {
    const id = +(event.target as HTMLSelectElement).value;
    this.formData.product_id = id;
  }

  formatProductLabel(p: Product): string {
    const brand = p.brand?.name || '';
    const dim = p.tyre?.tire_width ? `${p.tyre.tire_width}/${p.tyre.tire_height}R${p.tyre.tire_diameter}` : '';
    const profile = p.profile || '';
    const ref = p.reference || '';
    const indexes = [p.tyre?.tire_load_index, p.tyre?.tire_speed_index].filter(Boolean).join('');
    return [brand, dim, profile, indexes, ref].filter(Boolean).join(' — ');
  }

  onSubmit() {
    if (this.reasonRequired() && this.reason().trim().length < 3) {
      return;
    }
    const payload: StockPayload = { ...this.formData };
    if (this.quantityChanged()) {
      payload.reason = this.reason().trim();
    }
    this.save.emit(payload);
  }
}
