import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Purchase, PurchaseItem, PurchasePayload } from '../../../core/models/purchase.model';
import { PURCHASE_STATUSES, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_TRANSITIONS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, PurchaseStatus } from '../../../core/constants/status.constants';
import { Product } from '../../../core/models/product.model';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ProductService } from '../../../core/services/product.service';
import { SupplierService } from '../../suppliers/data-access/supplier.service';
import { Supplier } from '../../suppliers/models/supplier.model';
import { Stock } from '../../../core/models/stock.model';
import { StockService } from '../../../core/services/stock.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule, ProductDetailComponent],
  templateUrl: './purchase-form.component.html',
  styleUrls: ['./purchase-form.component.scss']
})
export class PurchaseFormComponent implements OnInit {
  readonly PURCHASE_STATUSES = PURCHASE_STATUSES;
  readonly PURCHASE_STATUS_LABELS = PURCHASE_STATUS_LABELS;
  readonly PAYMENT_STATUSES = PAYMENT_STATUSES;
  readonly PAYMENT_STATUS_LABELS = PAYMENT_STATUS_LABELS;

  /** Current status kept first (so it stays selected) followed by the statuses it can legally move to. Only relevant in edit mode — new purchases always start at EN COURS. */
  get statusOptions(): PurchaseStatus[] {
    const current = (this.formData.status as PurchaseStatus) || 'EN COURS';
    return [current, ...(PURCHASE_STATUS_TRANSITIONS[current] || [])];
  }

  @Input() purchase: Purchase | null = null;

  /**
   * Brouillon amorce par l'exterieur — aujourd'hui la file « Produits sous
   * seuil » de l'accueil. Distinct de `purchase`, qui signifie « mode edition »
   * et ferait partir la sauvegarde sur un PUT vers un achat inexistant.
   */
  @Input() preset: {
    supplier_id?: number | null;
    /** Référence de l'article, pour le retrouver et le nommer dans la ligne. */
    reference?: string | null;
    items?: PurchaseItem[];
  } | null = null;

  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private purchaseService = inject(PurchaseService);
  private productService = inject(ProductService);
  private supplierService = inject(SupplierService);
  private stockService = inject(StockService);
  private authService = inject(AuthService);

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
    bl_number: null,
    invoice_number: null,
    discount: 0,
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
      this.applyPreset();
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
          bl_number: this.purchase!.bl_number ?? null,
          invoice_number: this.purchase!.invoice_number ?? null,
          discount: this.purchase!.discount ?? 0,
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

  /**
   * Amorce le brouillon : fournisseur habituel et ligne deja remplie. Le
   * commercial est pose sur l'utilisateur courant, faute de quoi l'API refuse
   * l'enregistrement — `commercial_id` y est requis.
   *
   * Rien n'est enregistre : un achat cree decremente aussitot le stock, donc
   * le « brouillon » reste un formulaire tant que l'utilisateur n'a pas validé.
   */
  private applyPreset(): void {
    if (!this.preset) return;

    if (this.preset.supplier_id) {
      this.formData.supplier_id = this.preset.supplier_id;
    }

    if (this.preset.items?.length) {
      this.formData.items = [...this.preset.items];
      this.nameFirstPresetItem();
    }

    this.formData.commercial_id ??= this.authService.user()?.id ?? null;
  }

  /**
   * Retrouve l'article et son lot pour que la ligne porte un nom au lieu de
   * « Produit #3 ». On passe par la recherche existante — l'API n'expose pas
   * de lecture unitaire d'un produit.
   */
  private nameFirstPresetItem(): void {
    const item = this.formData.items[0];
    const reference = this.preset?.reference;
    if (!item || !reference) return;

    this.productService.getProducts({ search: reference, per_page: '5' }).subscribe({
      next: (res) => {
        const product = res.data.find((p) => p.id === item.product_id);
        if (product) (item as any).linkedProduct = product;
      },
    });

    if (!item.stock_id) return;

    this.stockService.getStocks({ product_id: String(item.product_id), per_page: '50' }).subscribe({
      next: (res) => {
        const stock = res.data.find((s) => s.id === item.stock_id);
        if (stock) (item as any).stock = stock;
      },
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

  get discountAmount(): number {
    return this.totalAmount * ((this.formData.discount ?? 0) / 100);
  }

  get netAmount(): number {
    return Math.max(0, this.totalAmount - this.discountAmount);
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
        alert(err.error?.message || 'Erreur lors de la sauvegarde');
        this.loading.set(false);
      }
    });
  }
}
