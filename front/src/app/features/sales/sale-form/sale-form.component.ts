import { Component, EventEmitter, Input, OnInit, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sale, SalePayload } from '../../../core/models/sale.model';
import { Product } from '../../../core/models/product.model';

import { ProductService } from '../../../core/services/product.service';
import { UserService } from '../../../core/services/user.service';
import { ManagedUser } from '../../../core/models/user-manage.model';
import { Carrier } from '../../../core/models/carrier.model';
import { CarrierService } from '../../../core/services/carrier.service';
import { Partner } from '../../../core/models/partner.model';
import { PartnerService } from '../../../core/services/partner.service';
import { Stock } from '../../../core/models/stock.model';
import { StockService } from '../../../core/services/stock.service';

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale-form.component.html',
  styleUrl: './sale-form.component.scss'
})
export class SaleFormComponent implements OnInit {
  @Input() sale: Sale | null = null;
  @Output() save = new EventEmitter<SalePayload>();
  @Output() cancel = new EventEmitter<void>();

  private productService = inject(ProductService);
  private stockService = inject(StockService);
  products = signal<Product[]>([]);
  productSearch = signal('');
  loadingProducts = signal(false);
  stocks = signal<Stock[]>([]);
  loadingStocks = signal(false);
  noStockAvailable = signal(false);
  formData: Partial<SalePayload> = {
    date: new Date().toISOString().split('T')[0],
    with_invoice: false,
    items: [],
    total_purchase: 0,
    total_sale: 0,
    margin: 0,

    city: '',
    carrier_id: null,
    tracking_number: '',
    partner_id: null,
    service: '',
    client: '',
    client_phone: '',
    payment_method: 'ESPECE',
    commercial_id: null,
    status: 'EN COURS',
    payment_status: 'NON PAYE',
    delivery_date: '',
    comments: ''
  };

  currentItem: any = {
    product_id: 0,
    stock_id: null,
    quantity: 1,
    purchase_price: 0,
    selling_price: 0,
    discount: 0,
    linkedProduct: null,
    stock: null
  };

  editingItemIndex: number | null = null;
  /** Quantity of the item when we started editing it — added back to stock.quantity for the insufficient check */
  editingOriginalQuantity = 0;
  logisticsCollapsed = signal(true);


  commercials = signal<ManagedUser[]>([]);
  carriers = signal<Carrier[]>([]);
  partners = signal<Partner[]>([]);


  private userService = inject(UserService);
  private carrierService = inject(CarrierService);
  private partnerService = inject(PartnerService);

  ngOnInit() {

    this.userService.getUsers({ all: true }).subscribe({
      next: (res: any) => { this.commercials.set(Array.isArray(res) ? res : res.data); }
    });
    this.carrierService.getCarriers({ all: true }).subscribe({
      next: (res: any) => { this.carriers.set(Array.isArray(res) ? res : res.data); }
    });
    this.partnerService.getPartners({ all: true }).subscribe({
      next: (res: any) => { this.partners.set(Array.isArray(res) ? res : res.data); }
    });
    this.searchProducts();

    if (this.sale) {
      this.formData = { ...this.sale };
      this.formData.date = this.sale.date?.substring(0, 10) || '';
      this.formData.delivery_date = this.sale.delivery_date?.substring(0, 10) || '';
      this.formData.items = this.sale.items ? JSON.parse(JSON.stringify(this.sale.items)) : [];
      
      // Load products for all items so they display correctly if we wanted to edit, but for now we just show them in the table.
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
    this.currentItem.stock = null;
    const product = this.products().find(p => p.id === id);
    if (product) {
      this.currentItem.linkedProduct = product;
      if (product.type === 'service') {
        // Services have no stock — pre-fill price from service default, purchase = 0
        this.stocks.set([]);
        this.noStockAvailable.set(false);
        this.currentItem.purchase_price = 0;
        this.currentItem.selling_price = Number(product.service?.selling_price ?? 0);
      } else {
        // Tyres and parts: load stocks. Parts can still be sold without a stock row.
        this.loadStocksForProduct(id);
      }
    } else {
      this.currentItem.linkedProduct = null;
      this.stocks.set([]);
    }
  }

  get isCurrentService(): boolean {
    return this.currentItem.linkedProduct?.type === 'service';
  }

  /** True when the current product line doesn't require a stock row (service or part). */
  get isStockOptional(): boolean {
    const type = this.currentItem.linkedProduct?.type;
    return type === 'service' || type === 'part';
  }

  loadStocksForProduct(productId: number, includeEmpty = false): void {
    this.loadingStocks.set(true);
    this.noStockAvailable.set(false);
    const filters: Record<string, string> = { product_id: String(productId), per_page: '100' };
    if (!includeEmpty) {
      filters['in_stock'] = '1';
    }
    this.stockService.getStocks(filters).subscribe({
      next: (res) => {
        let list = res.data;
        // If we're editing an existing item, make sure its stock row is in the list
        // even if the API filtered it out.
        const currentStock = this.currentItem.stock;
        const currentStockId = this.currentItem.stock_id;
        if (currentStockId && !list.find(s => s.id === currentStockId) && currentStock) {
          list = [currentStock, ...list];
        }
        this.stocks.set(list);
        this.noStockAvailable.set(list.length === 0);
        this.loadingStocks.set(false);
      },
      error: () => this.loadingStocks.set(false),
    });
  }

  onStockSelected(): void {
    const stock = this.selectedStock;
    if (stock) {
      this.currentItem.stock = stock;
      if (stock.purchase_price != null) {
        this.currentItem.purchase_price = Number(stock.purchase_price);
      }
    }
  }

  get selectedStock(): Stock | null {
    if (!this.currentItem.stock_id) return null;
    return this.stocks().find(s => s.id === this.currentItem.stock_id) || null;
  }

  get stockInsufficient(): boolean {
    const stock = this.selectedStock;
    if (!stock) return false;
    // When editing an existing line, the backend will revert that line's
    // previous quantity back into stock before re-applying the new quantity,
    // so the true available amount is stock.quantity + original quantity
    // (only if we're still editing the same stock row).
    let available = stock.quantity;
    if (this.editingItemIndex !== null) {
      const original: any = this.sale?.items?.[this.editingItemIndex];
      if (original && original.stock_id === stock.id) {
        available += Number(this.editingOriginalQuantity) || 0;
      }
    }
    return (this.currentItem.quantity || 0) > available;
  }

  addItem() {
    if (!this.currentItem.product_id) return;
    const stockOptional = this.isStockOptional;
    if (!stockOptional && !this.currentItem.stock_id) return;
    // Only check sufficiency when a stock row is actually selected
    if (this.currentItem.stock_id && this.stockInsufficient) {
      alert('Quantité insuffisante en stock.');
      return;
    }

    if (this.editingItemIndex !== null) {
      this.formData.items![this.editingItemIndex] = { ...this.currentItem };
    } else {
      this.formData.items!.push({ ...this.currentItem });
    }
    this.calculateTotals();
    this.resetCurrentItem();
  }

  editItem(index: number) {
    const item: any = this.formData.items![index];
    const product = item.linkedProduct || item.linked_product || item.product || null;
    this.editingOriginalQuantity = Number(item.quantity) || 0;
    this.currentItem = {
      product_id: item.product_id || product?.id || 0,
      stock_id: item.stock_id ?? null,
      quantity: item.quantity || 1,
      purchase_price: item.purchase_price ?? 0,
      selling_price: item.selling_price ?? 0,
      discount: Number(item.discount ?? 0),
      linkedProduct: product,
      stock: item.stock || null
    };
    // Ensure the product appears in the dropdown
    if (product && !this.products().find(p => p.id === product.id)) {
      this.products.set([product, ...this.products()]);
    }
    // Load stocks for non-service products so the stock dropdown is populated.
    // Include empty stocks so the row being edited (whose stock may now be 0
    // because it was already consumed by this sale) still appears.
    if (product && product.type !== 'service' && this.currentItem.product_id) {
      this.loadStocksForProduct(this.currentItem.product_id, true);
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
      purchase_price: 0,
      selling_price: 0,
      discount: 0,
      linkedProduct: null,
      stock: null
    };
    this.editingItemIndex = null;
    this.editingOriginalQuantity = 0;
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
    this.formData.items!.splice(index, 1);
    this.calculateTotals();
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
    } else if (p.type === 'service' && p.service?.category) {
      detail = p.service.category;
    }
    return [typeTag, ref, brand, detail, profile].filter(Boolean).join(' — ');
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
  }

  lineTotal(item: any): number {
    const qte = item.quantity || 1;
    const sell = item.selling_price || 0;
    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    return sell * qte * (1 - discount / 100);
  }

  calculateTotals() {
    let tp = 0;
    let ts = 0;
    for (const item of this.formData.items!) {
      tp += (item.purchase_price || 0) * (item.quantity || 1);
      ts += this.lineTotal(item);
    }
    this.formData.total_purchase = tp;
    this.formData.total_sale = ts;
    this.formData.margin = ts - tp;
  }

  onSubmit() {
    if (!this.formData.items || this.formData.items.length === 0) {
      alert('Veuillez ajouter au moins un produit.');
      return;
    }
    
    this.calculateTotals();
    this.save.emit(this.formData as SalePayload);
  }
}
