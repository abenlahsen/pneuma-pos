import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Brand, BrandPayload } from '../../models/brand.model';
import { ReferentialModalComponent } from '../../../../shared/referential-modal/referential-modal.component';

@Component({
  selector: 'app-brand-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReferentialModalComponent],
  templateUrl: './brand-form.component.html',
  styleUrls: ['../../../sales/sale-form/sale-form.component.scss', './brand-form.component.scss']
})
export class BrandFormComponent implements OnInit, OnChanges {
  @Input() brand: Brand | null = null;
  @Output() save = new EventEmitter<{ payload: BrandPayload; logo?: File }>();
  @Output() cancel = new EventEmitter<void>();

  formData: BrandPayload = {
    name: '',
    is_active: true,
  };

  logoFile?: File;
  logoPreview: string | null = null;

  /**
   * Ce qui dépend de la marque, annoncé en pied de la coque 15b. C'est aussi ce
   * qui bloque sa suppression côté serveur : une marque portant des produits ne
   * peut pas être supprimée. `null` tant qu'on ne le sait pas — à la création,
   * ou si l'API n'a pas renvoyé le compte : le pied reste alors vide plutôt que
   * d'afficher un zéro qui se lirait comme une certitude.
   */
  get linkedCount(): number | null {
    return this.brand?.products_count ?? null;
  }

  /** En français, zéro prend le singulier : « 0 produit lié », « 2 produits liés ». */
  get linkedLabel(): string {
    return (this.linkedCount ?? 0) > 1 ? 'produits liés' : 'produit lié';
  }

  ngOnInit() {
    this.syncFormWithBrand();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['brand']) {
      this.syncFormWithBrand();
    }
  }

  private syncFormWithBrand() {
    if (this.brand) {
      this.formData = {
        name: this.brand.name,
        is_active: this.brand.is_active,
      };
      this.logoFile = undefined;
      this.logoPreview = this.resolveLogoUrl(this.brand.logo);
      return;
    }

    this.formData = {
      name: '',
      is_active: true,
    };
    this.logoFile = undefined;
    this.logoPreview = null;
  }

  private resolveLogoUrl(logo: string | null | undefined): string | null {
    if (!logo) {
      return null;
    }

    if (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('data:')) {
      return logo;
    }

    return logo.startsWith('/storage/') ? logo : `/storage/${logo}`;
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
