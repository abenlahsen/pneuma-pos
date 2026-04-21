import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client, ClientPayload } from '../../models/client.model';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-form.component.html',
  styleUrls: ['../../../sales/sale-form/sale-form.component.scss']
})
export class ClientFormComponent implements OnInit {
  @Input() client: Client | null = null;
  @Output() save = new EventEmitter<ClientPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: ClientPayload = {
    name: '',
    category: 'Paticulier',
    phone: '',
    email: '',
    city: '',
    address: '',
    notes: '',
    is_active: true,
  };

  ngOnInit(): void {
    if (this.client) {
      this.formData = {
        name: this.client.name ?? '',
        category: this.client.category ?? 'Paticulier',
        phone: this.client.phone ?? '',
        email: this.client.email ?? '',
        city: this.client.city ?? '',
        address: this.client.address ?? '',
        notes: this.client.notes ?? '',
        is_active: this.client.is_active,
      };
    }
  }

  onSubmit(): void {
    this.save.emit(this.formData);
  }
}
