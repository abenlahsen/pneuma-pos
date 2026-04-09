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
    linkedProduct: null,
    stock: null
  };


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
    const product = this.products().find(p => p.id === id);
    if (product) {
      this.currentItem.linkedProduct = product;
      this.loadStocksForProduct(id);
    } else {
      this.stocks.set([]);
    }
  }

  loadStocksForProduct(productId: number): void {
    this.loadingStocks.set(true);
    this.noStockAvailable.set(false);
    this.stockService.getStocks({ product_id: String(productId), per_page: '100', in_stock: '1' }).subscribe({
      next: (res) => {
        this.stocks.set(res.data);
        this.noStockAvailable.set(res.data.length === 0);
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
    return (this.currentItem.quantity || 0) > stock.quantity;
  }

  addItem() {
    if (!this.currentItem.product_id || !this.currentItem.stock_id) return;
    if (this.stockInsufficient) {
      alert('Quantité insuffisante en stock.');
      return;
    }
    
    this.formData.items!.push({ ...this.currentItem });
    this.calculateTotals();

    // Reset current item
    this.currentItem = {
      product_id: 0,
      stock_id: null,
      quantity: 1,
      purchase_price: 0,
      selling_price: 0,
      linkedProduct: null,
      stock: null
    };
    this.productSearch.set('');
    this.products.set([]);
    this.stocks.set([]);
  }

  removeItem(index: number) {
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
    const brand = p.brand?.name || '';
    const dim = p.tire_width ? `${p.tire_width}/${p.tire_height}R${p.tire_diameter}` : '';
    const profile = p.profile || '';
    const ref = p.reference || '';
    return [ref, brand, dim, profile].filter(Boolean).join(' — ');
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
  }

  calculateTotals() {
    let tp = 0;
    let ts = 0;
    for (const item of this.formData.items!) {
      tp += (item.purchase_price || 0) * (item.quantity || 1);
      ts += (item.selling_price || 0) * (item.quantity || 1);
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
