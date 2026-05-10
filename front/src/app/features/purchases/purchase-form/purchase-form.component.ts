import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Purchase, PurchasePayload } from '../../../core/models/purchase.model';
import { Product } from '../../../core/models/product.model';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ProductService } from '../../../core/services/product.service';
import { SupplierService } from '../../suppliers/data-access/supplier.service';
import { Supplier } from '../../suppliers/models/supplier.model';
import { Stock } from '../../../core/models/stock.model';
import { StockService } from '../../../core/services/stock.service';

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductDetailComponent],
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
  private stockService = inject(StockService);

  loading = signal<boolean>(false);
  suppliers = signal<Supplier[]>([]);
  commercials = signal<{ id: number; name: string }[]>([]);
  products = signal<Product[]>([]);
  productSearch = signal('');
  loadingProducts = signal(false);
  stocks = signal<Stock[]>([]);
  loadingStocks = signal(false);

  currentItem: any = {
    product_id: 0,
    stock_id: null,
    quantity: 1,
    unit_price: 0,
    linkedProduct: null,
    stock: null
  };

  editingItemIndex: number | null = null;

  formData: PurchasePayload = {
    date: new Date().toISOString().split('T')[0],
    with_invoice: false,
    supplier_id: 0,
    commercial_id: null,
    items: [],
    status: 'EN COURS',
    payment_status: 'NON PAYE',
  };

  loadingForm = signal(false);

  ngOnInit(): void {
    this.searchProducts();

    if (!this.purchase) {
      this.loadSuppliers();
      this.loadCommercials();
      return;
    }

    this.loadingForm.set(true);
    forkJoin({
      suppliers: this.supplierService.getSuppliers({ all: true }),
      filters: this.purchaseService.getFilters(),
    }).subscribe({
      next: ({ suppliers, filters }) => {
        const data = Array.isArray(suppliers) ? suppliers : (suppliers as any).data;
        this.suppliers.set(data);
        this.commercials.set(filters.commercials);
        this.formData = {
          date: this.purchase!.date?.substring(0, 10) || '',
          with_invoice: !!this.purchase!.with_invoice,
          supplier_id: this.purchase!.supplier?.id || 0,
          commercial_id: this.purchase!.commercial?.id || null,
          items: this.purchase!.items ? JSON.parse(JSON.stringify(this.purchase!.items)) : [],
          status: this.purchase!.status,
          payment_status: this.purchase!.payment_status,
        };
        this.loadingForm.set(false);
      },
      error: () => this.loadingForm.set(false),
    });
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
        this.products.set(list);
        this.loadingProducts.set(false);
      },
      error: () => this.loadingProducts.set(false),
    });
  }

  onProductSelected(event: Event): void {
    const id = +(event.target as HTMLSelectElement).value;
    this.currentItem.product_id = id;
    this.currentItem.stock_id = null;
    const product = this.products().find(p => p.id === id);
    if (product) {
      this.currentItem.linkedProduct = product;
    }
    if (id) {
      this.loadStocksForProduct(id);
    } else {
      this.stocks.set([]);
    }
  }

  viewingProduct = signal<Product | null>(null);

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
  }

  openProductView(item: any): void {
    const product = this.getProduct(item);
    if (product) {
      this.viewingProduct.set(product);
    }
  }

  editProductInNewTab(product: Product): void {
    this.viewingProduct.set(null);
    window.open(`/products?id=${product.id}&edit=1`, '_blank', 'noopener');
  }

  onStockSelected(): void {
    const stock = this.stocks().find(s => s.id === this.currentItem.stock_id);
    if (stock) {
      this.currentItem.stock = stock;
    }
  }

  addItem() {
    if (!this.currentItem.product_id || !this.currentItem.stock_id || !this.currentItem.quantity || this.currentItem.unit_price == null) {
      alert('Veuillez remplir les informations de l\'article.');
      return;
    }
    if (this.editingItemIndex !== null) {
      this.formData.items[this.editingItemIndex] = { ...this.currentItem };
    } else {
      this.formData.items.push({ ...this.currentItem });
    }
    this.resetCurrentItem();
  }

  editItem(index: number) {
    const item: any = this.formData.items[index];
    const product = item.linkedProduct || item.linked_product || item.product || null;
    this.currentItem = {
      product_id: item.product_id || product?.id || 0,
      stock_id: item.stock_id ?? null,
      quantity: item.quantity || 1,
      unit_price: item.unit_price ?? 0,
      linkedProduct: product,
      stock: item.stock || null
    };
    if (product && !this.products().find(p => p.id === product.id)) {
      this.products.set([product, ...this.products()]);
    }
    if (this.currentItem.product_id) {
      this.loadStocksForProduct(this.currentItem.product_id);
    } else {
      this.stocks.set([]);
    }
    this.editingItemIndex = index;
  }

  cancelItemEdit() {
    this.resetCurrentItem();
  }

  private resetCurrentItem() {
    this.currentItem = {
      product_id: 0,
      stock_id: null,
      quantity: 1,
      unit_price: 0,
      linkedProduct: null,
      stock: null
    };
    this.editingItemIndex = null;
    this.productSearch.set('');
    this.products.set([]);
    this.stocks.set([]);
  }

  removeItem(index: number) {
    if (this.editingItemIndex === index) {
      this.resetCurrentItem();
    } else if (this.editingItemIndex !== null && this.editingItemIndex > index) {
      this.editingItemIndex--;
    }
    this.formData.items.splice(index, 1);
  }

  get totalAmount(): number {
    return this.formData.items.reduce((acc: number, item: any) => acc + (item.quantity * item.unit_price), 0);
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
    const typeTag = p.type === 'tyre' ? '[Pneu]' : p.type === 'part' ? '[Pièce]' : '[Service]';
    const brand = p.brand?.name || '';
    const ref = p.reference || '';
    const profile = p.profile || '';
    let detail = '';
    if (p.type === 'tyre' && p.tyre?.tire_width) {
      detail = `${p.tyre.tire_width}/${p.tyre.tire_height}R${p.tyre.tire_diameter}`;
    } else if (p.type === 'part' && p.part?.category) {
      detail = p.part.category;
    }
    return [typeTag, ref, brand, detail, profile].filter(Boolean).join(' — ');
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
    this.purchaseService.getFilters().subscribe({
      next: (res) => this.commercials.set(res.commercials),
    });
  }

  onSubmit(): void {

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
