import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { Sale } from '../../../../core/models/sale.model';
import { Carrier } from '../../../carriers/models/carrier.model';
import { CarrierService } from '../../../carriers/data-access/carrier.service';
import {
  ShipmentChangeField,
  ShipmentChangeItem,
  ShipmentChangeRequest,
  ShipmentChangeRequestPayload,
  SHIPMENT_CHANGE_FIELD_LABELS,
} from '../../models/shipment-change.model';

@Component({
  selector: 'app-shipment-change-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './shipment-change-form.component.html',
  styleUrl: './shipment-change-form.component.scss',
})
export class ShipmentChangeFormComponent implements OnInit {
  @Input({ required: true }) sale!: Sale;
  @Input() request: ShipmentChangeRequest | null = null;
  @Output() save = new EventEmitter<ShipmentChangeRequestPayload>();
  @Output() cancel = new EventEmitter<void>();

  readonly fieldOptions: { value: ShipmentChangeField; label: string }[] = (
    Object.keys(SHIPMENT_CHANGE_FIELD_LABELS) as ShipmentChangeField[]
  ).map((value) => ({ value, label: SHIPMENT_CHANGE_FIELD_LABELS[value] }));

  carriers = signal<Carrier[]>([]);
  carrierId = signal<number | null>(null);
  shipmentNumber = signal('');
  date = signal(new Date().toISOString().slice(0, 10));
  reason = signal('');
  items = signal<ShipmentChangeItem[]>([]);

  constructor(private carrierService: CarrierService) {}

  ngOnInit(): void {
    this.carrierService.getCarriers({ all: true }).subscribe({
      next: (res: any) => this.carriers.set(Array.isArray(res) ? res : res.data),
    });

    if (this.request) {
      this.carrierId.set(this.request.carrier_id);
      this.shipmentNumber.set(this.request.shipment_number || '');
      this.date.set(this.request.date);
      this.reason.set(this.request.reason || '');
      this.items.set((this.request.items || []).map(i => ({ ...i })));
    } else {
      this.carrierId.set(this.sale.carrier_id ?? this.sale.carrier?.id ?? null);
      this.shipmentNumber.set(this.sale.tracking_number || '');
      this.addItem();
    }
  }

  /**
   * L'ordre dans lequel une nouvelle ligne se sert. Il va du plus courant au
   * plus rare : une demande de modification porte presque toujours sur
   * l'adresse ou le destinataire, rarement sur le mode de paiement.
   *
   * `other` ferme la marche et n'est jamais « pris » : c'est le seul champ
   * qu'une demande peut porter plusieurs fois.
   */
  private static readonly FIELD_ORDER: ShipmentChangeField[] = [
    'address',
    'recipient_name',
    'recipient_phone',
    'city',
    'amount',
    'payment_method',
    'other',
  ];

  addItem(): void {
    const field = this.firstFreeField();
    this.items.update(list => [...list, {
      field,
      custom_label: null,
      old_value: this.prefillOldValue(field),
      new_value: '',
    }]);
  }

  /**
   * Le premier champ que personne n'a encore pris. Sans ça, chaque ligne
   * démarrait sur le mode de paiement — y compris la deuxième, alors que la
   * première venait de le prendre.
   */
  private firstFreeField(): ShipmentChangeField {
    const pris = new Set(this.items().map(item => item.field));
    return ShipmentChangeFormComponent.FIELD_ORDER.find(f => f === 'other' || !pris.has(f)) ?? 'other';
  }

  /**
   * Un champ déjà porté par une AUTRE ligne : le sélecteur le grise. `other`
   * échappe à la règle, et une ligne ne se bloque jamais elle-même.
   */
  isFieldTaken(field: ShipmentChangeField, index: number): boolean {
    if (field === 'other') return false;
    return this.items().some((item, i) => i !== index && item.field === field);
  }

  /**
   * L'ancienne valeur se verrouille quand elle vient du préremplissage : c'est
   * alors un constat tiré de la vente, pas une saisie.
   *
   * Elle reste modifiable dans les deux cas où personne ne peut la deviner :
   * une ligne « Autre », qui ne préremplit rien par nature, et un champ dont
   * la source est vide — la plupart des clients n'ont pas d'adresse
   * enregistrée. Sans ça, la lettre partirait chez le transporteur avec une
   * valeur actuelle vide, impossible à renseigner.
   */
  isOldValueLocked(item: ShipmentChangeItem): boolean {
    return item.field !== 'other' && !!item.old_value?.trim();
  }

  setOldValue(index: number, value: string): void {
    this.items.update(list => list.map((item, i) => i === index ? { ...item, old_value: value } : item));
  }

  removeItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  onFieldChange(index: number, field: ShipmentChangeField): void {
    this.items.update(list => list.map((item, i) => i === index
      ? { ...item, field, custom_label: field === 'other' ? item.custom_label : null, old_value: this.prefillOldValue(field) }
      : item));
  }

  private prefillOldValue(field: ShipmentChangeField): string {
    switch (field) {
      // L'adresse manquait : c'est pourtant le motif le plus courant d'une
      // demande de modification. Elle vient du client lié, la vente n'en
      // portant pas.
      case 'address':
        return this.sale?.linked_client?.address?.trim() || '';
      case 'recipient_name':
        return this.sale?.linked_client?.name?.trim() || this.sale?.client?.trim() || '';
      case 'recipient_phone':
        return this.sale?.linked_client?.phone?.trim() || this.sale?.client_phone?.trim() || '';
      case 'city':
        return this.sale?.linked_client?.city?.trim() || this.sale?.city?.trim() || '';
      case 'amount':
        return String(this.sale?.total_sale ?? this.sale?.total ?? '');
      case 'payment_method':
        return this.sale?.payment_methods?.length ? this.sale.payment_methods.join(', ') : '';
      default:
        return '';
    }
  }

  get canSubmit(): boolean {
    return !!this.date() && this.items().length > 0 && this.items().every(i => !!i.new_value?.trim());
  }

  onSubmit(): void {
    if (!this.canSubmit) return;

    this.save.emit({
      carrier_id: this.carrierId(),
      shipment_number: this.shipmentNumber() || null,
      date: this.date(),
      reason: this.reason() || null,
      items: this.items(),
    });
  }
}
