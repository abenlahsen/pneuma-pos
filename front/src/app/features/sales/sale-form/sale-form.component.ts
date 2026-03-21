import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sale, SalePayload } from '../../../core/models/sale.model';
import { Supplier } from '../../../core/models/supplier.model';
import { SupplierService } from '../../../core/services/supplier.service';
import { SalesRep } from '../../../core/models/sales-rep.model';
import { SalesRepService } from '../../../core/services/sales-rep.service';
import { Carrier } from '../../../core/models/carrier.model';
import { CarrierService } from '../../../core/services/carrier.service';
import { Partner } from '../../../core/models/partner.model';
import { PartnerService } from '../../../core/services/partner.service';

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

  formData: SalePayload = {
    date: new Date().toISOString().split('T')[0],
    with_invoice: false,
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
    sales_rep_id: null,
    status: 'EN COURS',
    payment_status: 'NON PAYE',
    delivery_date: '',
    comments: ''
  };

  suppliers: Supplier[] = [];
  salesReps: SalesRep[] = [];
  carriers: Carrier[] = [];
  partners: Partner[] = [];

  constructor(
    private supplierService: SupplierService,
    private salesRepService: SalesRepService,
    private carrierService: CarrierService,
    private partnerService: PartnerService
  ) {}

  ngOnInit() {
    this.supplierService.getSuppliers({ all: true }).subscribe({
      next: (res) => { this.suppliers = res as Supplier[]; }
    });
    this.salesRepService.getSalesReps({ all: true }).subscribe({
      next: (res) => { this.salesReps = res as SalesRep[]; }
    });
    this.carrierService.getCarriers({ all: true }).subscribe({
      next: (res) => { this.carriers = res as Carrier[]; }
    });
    this.partnerService.getPartners({ all: true }).subscribe({
      next: (res) => { this.partners = res as Partner[]; }
    });

    if (this.sale) {
      this.formData = { ...this.sale };
    }
  }

  calculateTotals() {
    const qte = this.formData.quantity || 0;
    this.formData.total_purchase = (this.formData.purchase_price || 0) * qte;
    this.formData.total_sale = (this.formData.selling_price || 0) * qte;
    const frais = this.formData.service_fee || 0;
    this.formData.margin = this.formData.total_sale - this.formData.total_purchase - frais;
  }

  onSubmit() {
    this.calculateTotals();
    this.save.emit(this.formData);
  }
}
