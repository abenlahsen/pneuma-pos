import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supplier, SupplierPayload } from '../../../core/models/supplier.model';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-form.component.html',
  styleUrl: './supplier-form.component.scss'
})
export class SupplierFormComponent implements OnInit {
  @Input() supplier: Supplier | null = null;
  @Output() save = new EventEmitter<SupplierPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: SupplierPayload = {
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: ''
  };

  ngOnInit() {
    if (this.supplier) {
      this.formData = { ...this.supplier };
    }
  }

  onSubmit() {
    this.save.emit(this.formData);
  }
}
