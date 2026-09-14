import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShipmentChangeRequest } from '../../models/shipment-change.model';
import { ShipmentChangeStatus, SHIPMENT_CHANGE_STATUSES, SHIPMENT_CHANGE_STATUS_LABELS } from '../../../../core/constants/status.constants';
import { IconComponent } from '../../../../shared/icon/icon.component';

import { StateSelectComponent } from '../../../../shared/state-badge/state-select.component';
import { StateBadgeComponent } from '../../../../shared/state-badge/state-badge.component';
import { statusTone } from '../../../../shared/state-badge/state-tone';

@Component({
  selector: 'app-shipment-change-list',
  standalone: true,
  imports: [StateBadgeComponent, StateSelectComponent, IconComponent, CommonModule, FormsModule],
  templateUrl: './shipment-change-list.component.html',
  styleUrl: './shipment-change-list.component.scss',
})
export class ShipmentChangeListComponent {
  readonly statusTone = statusTone;

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

  isClosed(request: ShipmentChangeRequest): boolean {
    return request.status === 'ACCEPTEE' || request.status === 'REFUSEE';
  }

  onStatusSelect(request: ShipmentChangeRequest, value: string): void {
    if (!value || value === request.status) return;
    this.statusChange.emit({ request, status: value as ShipmentChangeStatus });
  }
}
