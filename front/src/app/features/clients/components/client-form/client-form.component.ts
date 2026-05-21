import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client, ClientPayload } from '../../models/client.model';
import { CityService } from '../../../../core/services/city.service';

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

  cities: string[] = [];

  constructor(private cityService: CityService) {}

  formData: ClientPayload = {
    name: '',
    category: 'Paticulier',
    phone: '',
    email: '',
    city: '',
    address: '',
    notes: '',
    is_active: true,
    credit_limit: null,
    opening_balance: null,
    payment_terms_days: null,
    default_payment_method: null,
  };

  ngOnInit(): void {
    this.cityService.getCities().subscribe(cities => this.cities = cities);
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
        credit_limit: this.client.credit_limit ?? null,
        opening_balance: this.client.opening_balance ?? null,
        payment_terms_days: this.client.payment_terms_days ?? null,
        default_payment_method: this.client.default_payment_method ?? null,
      };
    }
  }

  onSubmit(): void {
    this.save.emit(this.formData);
  }
}
