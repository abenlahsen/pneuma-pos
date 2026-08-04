import {
  Component, Input, Output, EventEmitter,
  OnInit, signal, inject, ElementRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrintService } from '../../../../core/services/print.service';
import { CompanySettings } from '../../../settings/models/company-settings.model';
import { ShipmentChangeItem, ShipmentChangeRequest, SHIPMENT_CHANGE_FIELD_LABELS } from '../../models/shipment-change.model';

@Component({
  selector: 'app-shipment-change-print',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shipment-change-print.component.html',
  styleUrl: './shipment-change-print.component.scss',
})
export class ShipmentChangePrintComponent implements OnInit {
  @Input({ required: true }) request!: ShipmentChangeRequest;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('printZone', { static: true }) printZoneRef!: ElementRef<HTMLElement>;

  private printService = inject(PrintService);

  settings = signal<CompanySettings | null>(null);
  loadingSettings = signal(true);
  generatingPdf = signal(false);

  ngOnInit(): void {
    this.printService.getSettings().subscribe({
      next: (s) => { this.settings.set(s); this.loadingSettings.set(false); },
      error: () => this.loadingSettings.set(false),
    });
  }

  async downloadPdf(): Promise<void> {
    if (this.generatingPdf()) return;
    this.generatingPdf.set(true);
    try {
      await this.printService.downloadPdf(
        this.printZoneRef.nativeElement,
        `demande-modification-${this.filenameSuffix()}`,
      );
    } finally {
      this.generatingPdf.set(false);
    }
  }

  private filenameSuffix(): string {
    const shipmentNumber = this.request.shipment_number?.trim();
    if (!shipmentNumber) {
      return String(this.request.id);
    }
    return shipmentNumber.replace(/[^a-zA-Z0-9-_]+/g, '-');
  }

  fieldLabel(item: ShipmentChangeItem): string {
    if (item.field === 'other') {
      return item.custom_label || SHIPMENT_CHANGE_FIELD_LABELS.other;
    }
    return SHIPMENT_CHANGE_FIELD_LABELS[item.field];
  }
}
