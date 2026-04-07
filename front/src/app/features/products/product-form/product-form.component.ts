import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product, ProductPayload } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-form.component.html',
  styleUrls: ['../../sales/sale-form/sale-form.component.scss', './product-form.component.scss']
})
export class ProductFormComponent implements OnInit {
  @Input() product: Product | null = null;
  @Input() brands: { id: number; name: string }[] = [];
  @Output() save = new EventEmitter<ProductPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: ProductPayload = {
    profile: '',
    reference: '',
    type: 'tyre',
    brand_id: null,
    description: '',
    unit: 'piece',
    is_active: true,
    tire_width: null,
    tire_height: null,
    tire_diameter: null,
    tire_load_index: '',
    tire_speed_index: '',
    tire_season: null,
    tire_runflat: false,
    tire_reinforced: false,
    tire_marking: '',
    eu_fuel: null,
    eu_wet_grip: null,
    eu_noise_db: null,
    eu_noise_class: null,
  };

  ngOnInit() {
    if (this.product) {
      this.formData = {
        profile: this.product.profile || '',
        reference: this.product.reference || '',
        type: this.product.type,
        brand_id: this.product.brand_id,
        description: this.product.description || '',
        unit: this.product.unit || 'piece',
        is_active: this.product.is_active,
        tire_width: this.product.tire_width,
        tire_height: this.product.tire_height,
        tire_diameter: this.product.tire_diameter,
        tire_load_index: this.product.tire_load_index || '',
        tire_speed_index: this.product.tire_speed_index || '',
        tire_season: this.product.tire_season,
        tire_runflat: this.product.tire_runflat,
        tire_reinforced: this.product.tire_reinforced,
        tire_marking: this.product.tire_marking || '',
        eu_fuel: this.product.eu_fuel,
        eu_wet_grip: this.product.eu_wet_grip,
        eu_noise_db: this.product.eu_noise_db,
        eu_noise_class: this.product.eu_noise_class,
      };
    }
  }

  get isTyre(): boolean {
    return this.formData.type === 'tyre';
  }

  onSubmit() {
    this.save.emit(this.formData);
  }
}
