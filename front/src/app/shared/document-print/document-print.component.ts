import {
  Component, Input, Output, EventEmitter,
  OnInit, signal, inject, ElementRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrintService } from '../../core/services/print.service';
import { CompanySettings } from '../../features/settings/models/company-settings.model';

export type DocumentType = 'sale' | 'purchase' | 'service_order';

export interface PrintLine {
  label: string;
  reference?: string;
  qty: number;
  unit?: string;
  unit_price: number;
  discount?: number;
  total: number;
}

export interface PrintDocument {
  type: DocumentType;
  doc_number: string;
  date: string;
  party_label: string;
  party_name: string;
  party_phone?: string | null;
  party_city?: string | null;
  lines: PrintLine[];
  total_ht: number;
  discount_global?: number;
  net_amount: number;
  status?: string;
  payment_status?: string;
  notes?: string | null;
  commercial?: string | null;
  vehicle?: string | null;
  mileage?: number | null;
  carrier?: string | null;
  tracking_number?: string | null;
  partner?: string | null;
  service?: string | null;
  delivery_date?: string | null;
  payment_method?: string | null;
}

@Component({
  selector: 'app-document-print',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-print.component.html',
  styleUrl: './document-print.component.scss',
})
export class DocumentPrintComponent implements OnInit {
  @Input({ required: true }) document!: PrintDocument;
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
        `${this.document.type}-${this.document.doc_number}`,
      );
    } finally {
      this.generatingPdf.set(false);
    }
  }

  getDocumentTitle(): string {
    const titles: Record<DocumentType, string> = {
      sale: 'BON DE VENTE',
      purchase: "BON D'ACHAT",
      service_order: "FICHE D'INTERVENTION",
    };
    return titles[this.document.type] ?? 'DOCUMENT';
  }

  hasDiscounts(): boolean {
    return this.document.lines.some(l => l.discount && l.discount > 0);
  }

  hasTransport(): boolean {
    const d = this.document;
    return !!(d.carrier || d.tracking_number || d.partner || d.service || d.delivery_date || d.payment_method);
  }
}
