import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RowOverflowComponent } from '../../../../shared/row-overflow/row-overflow.component';
import { RowLockComponent } from '../../../../shared/list-state';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { ShipmentChangeRequest } from '../../models/shipment-change.model';
import { ShipmentChangeStatus, SHIPMENT_CHANGE_STATUSES, SHIPMENT_CHANGE_STATUS_LABELS } from '../../../../core/constants/status.constants';

@Component({
  selector: 'app-shipment-change-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, RowOverflowComponent, RowLockComponent],
  templateUrl: './shipment-change-list.component.html',
  styleUrl: './shipment-change-list.component.scss',
})
export class ShipmentChangeListComponent {
  /**
   * Règle 3 du motif de ligne : la date, le transporteur et le numéro
   * d'expédition qualifient la demande sans qu'on trie jamais dessus — une
   * vente en compte rarement plus de trois.
   */
  subLineFor(request: ShipmentChangeRequest): string {
    return [
      request.date ? new Date(request.date).toLocaleDateString('fr-FR') : null,
      request.carrier?.name || null,
      request.shipment_number || null,
    ].filter((p): p is string => !!p).join(' · ');
  }

  @Input() requests: ShipmentChangeRequest[] = [];
  @Input() loading = false;
  @Input() canCreate = false;
  @Input() canEdit = false;
  @Input() canDelete = false;

  @Output() add = new EventEmitter<void>();
  @Output() print = new EventEmitter<ShipmentChangeRequest>();
  @Output() edit = new EventEmitter<ShipmentChangeRequest>();
  @Output() statusChange = new EventEmitter<{ request: ShipmentChangeRequest; status: ShipmentChangeStatus }>();
  @Output() delete = new EventEmitter<ShipmentChangeRequest>();

  readonly statusLabels = SHIPMENT_CHANGE_STATUS_LABELS;
  readonly allStatuses = SHIPMENT_CHANGE_STATUSES;

  statusClass(status: ShipmentChangeStatus): string {
    switch (status) {
      case 'ACCEPTEE': return 'badge-success';
      case 'REFUSEE':  return 'badge-danger';
      case 'ENVOYEE':  return 'badge-warning';
      default:         return 'badge-neutral';
    }
  }

  isClosed(request: ShipmentChangeRequest): boolean {
    return request.status === 'ACCEPTEE' || request.status === 'REFUSEE';
  }

  onStatusSelect(request: ShipmentChangeRequest, value: string): void {
    if (!value || value === request.status) return;
    this.statusChange.emit({ request, status: value as ShipmentChangeStatus });
  }
}
