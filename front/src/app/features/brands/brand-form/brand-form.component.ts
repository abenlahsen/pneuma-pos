import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Brand, BrandPayload } from '../../../core/models/brand.model';

@Component({
  selector: 'app-brand-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './brand-form.component.html',
  styleUrls: ['../../sales/sale-form/sale-form.component.scss', './brand-form.component.scss']
})
export class BrandFormComponent implements OnInit {
  @Input() brand: Brand | null = null;
  @Output() save = new EventEmitter<{ payload: BrandPayload; logo?: File }>();
  @Output() cancel = new EventEmitter<void>();

  formData: BrandPayload = {
    name: '',
    is_active: true,
  };

  logoFile?: File;
  logoPreview: string | null = null;

  ngOnInit() {
    if (this.brand) {
      this.formData = {
        name: this.brand.name,
        is_active: this.brand.is_active,
      };
      this.logoPreview = this.brand.logo ? '/storage/' + this.brand.logo : null;
    }
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.logoFile = input.files[0];
      const reader = new FileReader();
      reader.onload = () => this.logoPreview = reader.result as string;
      reader.readAsDataURL(this.logoFile);
    }
  }

  onSubmit() {
    this.save.emit({ payload: this.formData, logo: this.logoFile });
  }
}
