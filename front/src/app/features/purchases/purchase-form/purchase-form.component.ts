import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Purchase, PurchasePayload } from '../../../core/models/purchase.model';
import { PurchaseService } from '../../../core/services/purchase.service';
import { SupplierService } from '../../../core/services/supplier.service';
import { PersonnelService } from '../../../core/services/personnel.service';
import { Supplier } from '../../../core/models/supplier.model';
import { Personnel } from '../../../core/models/personnel.model';

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
  private supplierService = inject(SupplierService);
  private personnelService = inject(PersonnelService);

  loading = signal<boolean>(false);
  suppliers = signal<Supplier[]>([]);
  commercials = signal<Personnel[]>([]);

  formData: PurchasePayload = {
    date: new Date().toISOString().split('T')[0],
    product: '',
    supplier_id: 0,
    commercial_id: null,
    quantity: 1,
    unit_price: 0,
    status: 'EN COURS',
    payment_status: 'NON PAYE',
    payment_method: null,
    payment_date: null
  };

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadCommercials();

    if (this.purchase) {
      this.formData = {
        date: this.purchase.date,
        product: this.purchase.product,
        supplier_id: this.purchase.supplier_id,
        commercial_id: this.purchase.commercial_id,
        quantity: this.purchase.quantity,
        unit_price: this.purchase.unit_price,
        status: this.purchase.status,
        payment_status: this.purchase.payment_status,
        payment_method: this.purchase.payment_method,
        payment_date: this.purchase.payment_date
      };
    }
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
    this.personnelService.getAllPersonnels().subscribe({
      next: (res) => {
        this.commercials.set(res);
      }
    });
  }

  onSubmit(): void {
    if (!this.formData.date || !this.formData.product || !this.formData.supplier_id || !this.formData.quantity || this.formData.unit_price === null) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }

    if (this.formData.payment_status === 'PAYE' && !this.formData.payment_date) {
        this.formData.payment_date = new Date().toISOString().split('T')[0];
    }
    if (this.formData.payment_status === 'NON PAYE') {
        this.formData.payment_date = null;
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
