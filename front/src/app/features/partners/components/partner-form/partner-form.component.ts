import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Partner, PartnerPayload } from '../../models/partner.model';
import { CityService } from '../../../../core/services/city.service';

@Component({
  selector: 'app-partner-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './partner-form.component.html',
  styleUrls: ['../../../sales/sale-form/sale-form.component.scss']
})
export class PartnerFormComponent implements OnInit {
  @Input() partner: Partner | null = null;
  @Output() save = new EventEmitter<PartnerPayload>();
  @Output() cancel = new EventEmitter<void>();

  cities: string[] = [];

  constructor(private cityService: CityService) {}

  formData: PartnerPayload = {
    name: '',
    city: '',
    phone: '',
    mobile: '',
    address: '',
    montage_price: undefined,
    alignment_price: undefined
  };

  ngOnInit() {
    this.cityService.getCities().subscribe(cities => this.cities = cities);
    if (this.partner) {
      this.formData = { ...this.partner };
    }
  }

  onSubmit() {
    this.save.emit(this.formData);
  }
}
