import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Carrier, CarrierPayload } from '../../models/carrier.model';
import { ReferentialModalComponent } from '../../../../shared/referential-modal/referential-modal.component';

@Component({
  selector: 'app-carrier-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReferentialModalComponent],
  templateUrl: './carrier-form.component.html',
  styleUrls: ['../../../sales/sale-form/sale-form.component.scss']
})
export class CarrierFormComponent implements OnInit {
  @Input() carrier: Carrier | null = null;
  @Output() save = new EventEmitter<CarrierPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: CarrierPayload = { name: '', phone: '', email: '' };

  ngOnInit() {
    if (this.carrier) {
      // Champ par champ, et non un étalement de l'objet : le transporteur porte
      // désormais un compte de ventes, qui n'a rien à faire dans le corps envoyé.
      this.formData = {
        name: this.carrier.name,
        phone: this.carrier.phone,
        email: this.carrier.email,
      };
    }
  }

  /**
   * Ce qui dépend du transporteur, annoncé en pied de la coque 15b. Rien ne
   * bloque la suppression côté serveur — la clé étrangère est en nullOnDelete,
   * les ventes survivent sans transporteur — donc ce compte est le seul
   * avertissement avant l'action. `null` tant qu'on ne le sait pas.
   */
  get linkedCount(): number | null {
    return this.carrier?.sales_count ?? null;
  }

  /** En français, zéro prend le singulier : « 0 vente livrée », « 2 ventes livrées ». */
  get linkedLabel(): string {
    return (this.linkedCount ?? 0) > 1 ? 'ventes livrées' : 'vente livrée';
  }

  onSubmit() {
    this.save.emit(this.formData);
  }
}
