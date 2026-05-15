import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { SettingsService } from '../../features/settings/data-access/settings.service';
import { CompanySettings } from '../../features/settings/models/company-settings.model';

@Injectable({ providedIn: 'root' })
export class PrintService {
  private settingsService = inject(SettingsService);
  private settings$: Observable<CompanySettings> | null = null;

  getSettings(): Observable<CompanySettings> {
    if (!this.settings$) {
      this.settings$ = this.settingsService.getCompanySettings().pipe(shareReplay(1));
    }
    return this.settings$;
  }

  private async generatePdf(element: HTMLElement): Promise<any> {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf;
  }

  async downloadPdf(element: HTMLElement, filename: string): Promise<void> {
    const pdf = await this.generatePdf(element);
    pdf.save(`${filename}.pdf`);
  }


}
