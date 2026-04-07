import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
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
      if (this.stock.product) {
        this.editingProduct = this.stock.product;
        this.products.set([this.stock.product]);
      }
    }
    this.searchProducts();
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
    const dim = p.tire_width ? `${p.tire_width}/${p.tire_height}R${p.tire_diameter}` : '';
    const profile = p.profile || '';
    const ref = p.reference || '';
    const indexes = [p.tire_load_index, p.tire_speed_index].filter(Boolean).join('');
    return [brand, dim, profile, indexes, ref].filter(Boolean).join(' — ');
  }

  onSubmit() {
    this.save.emit(this.formData);
  }
}
