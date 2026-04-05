import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Purchase, PurchasePayload } from '../../../core/models/purchase.model';
import { Product } from '../../../core/models/product.model';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ProductService } from '../../../core/services/product.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { UserService } from '../../../core/services/user.service';
import { Supplier } from '../../../core/models/supplier.model';
import { ManagedUser } from '../../../core/models/user-manage.model';
import { Stock } from '../../../core/models/stock.model';
import { StockService } from '../../../core/services/stock.service';

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-form.component.html',
  styleUrls: ['./purchase-form.component.scss']
})
export class PurchaseFormComponent implements OnInit {
  @Input() purchase: Purchase | null = null;
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private purchaseService = inject(PurchaseService);
  private productService = inject(ProductService);
  private supplierService = inject(SupplierService);
  private userService = inject(UserService);
  private stockService = inject(StockService);

  loading = signal<boolean>(false);
  suppliers = signal<Supplier[]>([]);
  commercials = signal<ManagedUser[]>([]);
  products = signal<Product[]>([]);
  productSearch = signal('');
  loadingProducts = signal(false);
  stocks = signal<Stock[]>([]);
  loadingStocks = signal(false);
  private editingProduct: Product | null = null;

  formData: PurchasePayload = {
    date: new Date().toISOString().split('T')[0],
    product: '',
    product_id: 0,
    stock_id: null,
    supplier_id: 0,
    commercial_id: null,
    quantity: 1,
    unit_price: 0,
    status: 'EN COURS',
    payment_status: 'NON PAYE',
  };

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadCommercials();
    this.searchProducts();

    if (this.purchase) {
      this.formData = {
        date: this.purchase.date?.substring(0, 10) || '',
        product: this.purchase.product || '',
        product_id: this.purchase.product_id || 0,
        stock_id: this.purchase.stock_id || null,
        supplier_id: this.purchase.supplier_id,
        commercial_id: this.purchase.commercial_id,
        quantity: this.purchase.quantity,
        unit_price: this.purchase.unit_price,
        status: this.purchase.status,
        payment_status: this.purchase.payment_status,
      };
      if (this.purchase.linked_product) {
        this.editingProduct = this.purchase.linked_product;
        this.products.set([this.purchase.linked_product]);
      }
      if (this.purchase.product_id) {
        this.loadStocksForProduct(this.purchase.product_id);
      }
    }
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
    this.formData.stock_id = null;
    if (id) {
      this.loadStocksForProduct(id);
    } else {
      this.stocks.set([]);
    }
  }

  loadStocksForProduct(productId: number): void {
    this.loadingStocks.set(true);
    this.stockService.getStocks({ product_id: String(productId), per_page: '100' }).subscribe({
      next: (res) => {
        this.stocks.set(res.data);
        this.loadingStocks.set(false);
      },
      error: () => this.loadingStocks.set(false),
    });
  }

  formatStockLabel(s: Stock): string {
    const parts: string[] = [];
    if (s.depot) parts.push(s.depot);
    if (s.zone) parts.push(s.zone);
    if (s.dot) parts.push('DOT ' + s.dot);
    parts.push('Qté: ' + s.quantity);
    return parts.join(' — ');
  }

  formatProductLabel(p: Product): string {
    const brand = p.brand?.name || '';
    const dim = p.tire_width ? `${p.tire_width}/${p.tire_height}R${p.tire_diameter}` : '';
    const profile = p.profile || '';
    const ref = p.reference || '';
    return [ref, brand, dim, profile].filter(Boolean).join(' — ');
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers({ all: true }).subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : res.data;
        this.suppliers.set(data);
      }
    });
  }

  loadCommercials(): void {
    this.userService.getUsers({ all: true }).subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : res.data;
        this.commercials.set(data);
      }
    });
  }

  onSubmit(): void {
    if (!this.formData.date || !this.formData.product_id || !this.formData.supplier_id || !this.formData.quantity || this.formData.unit_price === null) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }
    if (!this.formData.stock_id) {
      alert('Veuillez sélectionner un stock pour ce produit.');
      return;
    }

    this.loading.set(true);

    const request = this.purchase
      ? this.purchaseService.updatePurchase(this.purchase.id, this.formData)
      : this.purchaseService.createPurchase(this.formData);

    request.subscribe({
      next: () => {
        this.loading.set(false);
        this.save.emit();
      },
      error: (err) => {
        console.error('Error saving purchase', err);
        alert('Erreur lors de la sauvegarde');
        this.loading.set(false);
      }
    });
  }
}
