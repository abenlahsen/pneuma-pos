import { Component, EventEmitter, Input, OnInit, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sale, SalePayload } from '../../../core/models/sale.model';
import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/supplier.model';
import { SupplierService } from '../../../core/services/supplier.service';
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
  private editingProduct: Product | null = null;

  formData: Partial<SalePayload> = {
    date: new Date().toISOString().split('T')[0],
    with_invoice: false,
    product_id: 0,
    stock_id: null,
    quantity: 1,
    dimension: '',
    ic: '',
    iv: '',
    rft: '',
    brand: '',
    profile: '',
    purchase_price: 0,
    total_purchase: 0,
    selling_price: 0,
    total_sale: 0,
    margin: 0,
    supplier_id: null,
    city: '',
    carrier_id: null,
    tracking_number: '',
    partner_id: null,
    service: '',
    service_fee: 0,
    client: '',
    payment_method: 'ESPECE',
    commercial_id: null,
    status: 'EN COURS',
    payment_status: 'NON PAYE',
    delivery_date: '',
    comments: ''
  };

  suppliers = signal<Supplier[]>([]);
  commercials = signal<ManagedUser[]>([]);
  carriers = signal<Carrier[]>([]);
  partners = signal<Partner[]>([]);

  private supplierService = inject(SupplierService);
  private userService = inject(UserService);
  private carrierService = inject(CarrierService);
  private partnerService = inject(PartnerService);

  ngOnInit() {
    this.supplierService.getSuppliers({ all: true }).subscribe({
      next: (res: any) => { this.suppliers.set(Array.isArray(res) ? res : res.data); }
    });
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
      this.formData.product_id = this.sale.product_id || 0;
      this.formData.stock_id = this.sale.stock_id || null;
      if (this.sale.linked_product) {
        this.editingProduct = this.sale.linked_product;
        this.products.set([this.sale.linked_product]);
      }
      if (this.sale.product_id) {
        this.loadStocksForProduct(this.sale.product_id);
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
    const product = this.products().find(p => p.id === id);
    if (product) {
      this.formData.brand = product.brand?.name || '';
      const dim = product.tire_width ? `${product.tire_width}/${product.tire_height}R${product.tire_diameter}` : '';
      this.formData.dimension = dim;
      this.formData.profile = product.profile || '';
      this.formData.ic = product.tire_load_index || '';
      this.formData.iv = product.tire_speed_index || '';
      this.formData.rft = product.tire_runflat ? 'OUI' : '';
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

  get selectedStock(): Stock | null {
    if (!this.formData.stock_id) return null;
    return this.stocks().find(s => s.id === this.formData.stock_id) || null;
  }

  get stockInsufficient(): boolean {
    const stock = this.selectedStock;
    if (!stock) return false;
    return (this.formData.quantity || 0) > stock.quantity;
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

  calculateTotals() {
    const qte = this.formData.quantity || 0;
    this.formData.total_purchase = (this.formData.purchase_price || 0) * qte;
    this.formData.total_sale = (this.formData.selling_price || 0) * qte;
    const frais = this.formData.service_fee || 0;
    this.formData.margin = this.formData.total_sale - this.formData.total_purchase - frais;
  }

  onSubmit() {
    if (!this.formData.stock_id) {
      alert('Veuillez sélectionner un stock pour ce produit.');
      return;
    }
    if (this.stockInsufficient) {
      alert('Quantité insuffisante en stock.');
      return;
    }
    this.calculateTotals();
    this.save.emit(this.formData as SalePayload);
  }
}
