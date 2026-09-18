import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supplier, SupplierPayload } from '../../models/supplier.model';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-form.component.html',
  styleUrls: ['../../../sales/sale-form/sale-form.component.scss', './supplier-form.component.scss']
})
export class SupplierFormComponent implements OnInit, OnChanges {
  @Input() supplier: Supplier | null = null;
  @Output() save = new EventEmitter<SupplierPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: SupplierPayload = {
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    payment_terms_days: null,
  };

  ngOnInit() {
    this.syncFormWithSupplier();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['supplier']) {
      this.syncFormWithSupplier();
    }
  }

  private syncFormWithSupplier() {
    if (this.supplier) {
      this.formData = {
        name: this.supplier.name ?? '',
        contact_person: this.supplier.contact_person ?? '',
        phone: this.supplier.phone ?? '',
        email: this.supplier.email ?? '',
        address: this.supplier.address ?? '',
        payment_terms_days: this.supplier.payment_terms_days ?? null,
      };
      return;
    }

    this.formData = {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      payment_terms_days: null,
    };
  }

  normalizeEmail() {
    this.formData.email = (this.formData.email ?? '').trim().toLowerCase();
  }

  onSubmit() {
    this.normalizeEmail();
    this.save.emit(this.formData);
  }
}
