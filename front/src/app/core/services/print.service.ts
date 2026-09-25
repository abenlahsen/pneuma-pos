import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { SettingsService } from '../../features/settings/data-access/settings.service';
import { CompanySettings } from '../../features/settings/models/company-settings.model';

/** Un morceau vertical du contenu, en pixels CSS depuis le haut du contenu. */
export interface PdfSlice {
  start: number;
  end: number;
  /** Cette page reprend le tableau : son en-tête est redessiné en haut. */
  repeatHead: boolean;
}

/** Une unité que le PDF ne coupe pas : un bloc, ou une ligne du tableau. */
export interface PdfUnit {
  top: number;
  bottom: number;
  isRow: boolean;
}

/**
 * Découpe un contenu en pages sans jamais couper une unité — refonte 2b, 10a.
 *
 * Fonction pure, sortie du service pour être testée sans DOM : jsdom ne
 * calcule aucune géométrie, alors que c'est ici que se joue la promesse
 * « une ligne n'est jamais coupée entre deux pages ».
 *
 * - Une page s'arrête AVANT l'unité qui la ferait déborder.
 * - Une page qui commence par une ligne du tableau réserve la hauteur de
 *   l'en-tête, redessiné au-dessus.
 * - L'en-tête ne reste jamais seul en bas d'une page : si la première ligne ne
 *   tient pas, la coupure remonte au-dessus de l'en-tête.
 * - Une unité plus haute qu'une page entière (une note interminable) est
 *   coupée de force plutôt que de bloquer : c'est le seul cas où un morceau
 *   est tranché.
 */
export function paginate(
  units: PdfUnit[],
  contentHeight: number,
  pageHeight: number,
  head: { top: number; bottom: number } | null,
): PdfSlice[] {
  const headHeight = head ? head.bottom - head.top : 0;
  const slices: PdfSlice[] = [];
  const firstRow = units.find(u => u.isRow) ?? null;

  let start = 0;
  let repeatHead = false;

  const push = (end: number) => {
    // Coupe forcée d'un morceau trop haut pour une page, par tranches.
    let from = start;
    let repeat = repeatHead;
    while (end - from > pageHeight - (repeat ? headHeight : 0) + 0.5) {
      const room = pageHeight - (repeat ? headHeight : 0);
      slices.push({ start: from, end: from + room, repeatHead: repeat });
      from += room;
      repeat = false;
    }
    slices.push({ start: from, end, repeatHead: repeat });
  };

  for (const unit of units) {
    const reserved = repeatHead ? headHeight : 0;
    if (unit.bottom - start + reserved <= pageHeight || unit.top <= start) continue;

    // L'en-tête ne part pas seul : on coupe au-dessus de lui.
    const orphanHead = !!head && unit === firstRow && head.top > start;
    const breakAt = orphanHead ? head!.top : unit.top;

    push(breakAt);
    start = breakAt;
    repeatHead = unit.isRow && !orphanHead;
  }

  push(Math.max(start, contentHeight));
  return slices;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

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

  /**
   * La lettre au transporteur (18c) : une feuille de hauteur fixe, capturée
   * d'un bloc. Le découpage en tranches de 297 mm ci-dessus ne sert qu'à
   * elle — sur un document de plusieurs pages, il couperait des lignes.
   */
  async downloadPdf(element: HTMLElement, filename: string): Promise<void> {
    const pdf = await this.generatePdf(element);
    pdf.save(`${filename}.pdf`);
  }

  /**
   * L'imprimé de vente, d'achat et d'intervention (19a) : un document de
   * plusieurs pages, paginé comme l'impression.
   *
   * html2canvas reste l'outil : il capture le contenu une fois, puis chaque
   * page est recomposée sur son propre canevas à partir des frontières
   * MESURÉES dans le DOM — jamais à hauteur fixe. Le contrat avec la feuille
   * passe par les attributs `data-pdf` (voir document-print.component.html) :
   *
   *   content  le contenu, marges exclues ;
   *   block    un bloc insécable (en-tête, tiers, notes, clôture) ;
   *   row      une ligne du tableau, insécable ;
   *   thead    l'en-tête du tableau, redessiné en haut des pages suivantes ;
   *   footer   les mentions légales, posées au bas de chaque page.
   */
  async downloadDocumentPdf(sheet: HTMLElement, filename: string): Promise<void> {
    const content = sheet.querySelector<HTMLElement>('[data-pdf="content"]');
    const footer = sheet.querySelector<HTMLElement>('[data-pdf="footer"]');
    if (!content) return;

    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    // Le mode capture, posé sur la feuille réelle le temps de la génération
    // (voir `.pdf-capture` dans document-print et dans la page) :
    //  - il annule le zoom d'écran étroit : la pagination se mesure à l'échelle 1 ;
    //  - il coupe les chiffres tabulaires et les alternates contextuelles
    //    d'Inter. html2canvas dessine le texte par morceaux, coupés après « / »
    //    et « - », à la position mesurée dans le DOM ; le canevas ignore
    //    `tnum`, et une alternate perd son contexte à la coupure. Avec ces
    //    variantes, le texte sortait troué — « 19 /05 », « X- FIT ».
    // Posé AVANT la mesure, il garantit que la mise en page mesurée est celle
    // qui est dessinée.
    sheet.classList.add('pdf-capture');
    try {
      await nextFrame();
      await nextFrame();
      await this.renderDocumentPdf(content, footer, html2canvas, jsPDF, filename);
    } finally {
      sheet.classList.remove('pdf-capture');
    }
  }

  private async renderDocumentPdf(
    content: HTMLElement,
    footer: HTMLElement | null,
    html2canvas: (el: HTMLElement, options?: any) => Promise<HTMLCanvasElement>,
    jsPDF: any,
    filename: string,
  ): Promise<void> {
    const capture = (el: HTMLElement) => html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    const contentCanvas = await capture(content);
    const footerCanvas = footer && footer.offsetHeight > 0 ? await capture(footer) : null;

    // ── Géométrie, en pixels CSS du contenu ────────────────────────────────
    // Le mode capture a remis la feuille à l'échelle 1. Par sécurité, si un
    // ancêtre la réduisait encore, getBoundingClientRect subirait la
    // réduction et offsetWidth non : leur rapport ramène les mesures à 1.
    const base = content.getBoundingClientRect();
    const zoom = base.width / content.offsetWidth || 1;
    const measure = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: (r.top - base.top) / zoom, bottom: (r.bottom - base.top) / zoom };
    };

    const units: PdfUnit[] = Array.from(
      content.querySelectorAll('[data-pdf="block"], [data-pdf="row"]'),
    ).map(el => ({ ...measure(el), isRow: el.getAttribute('data-pdf') === 'row' }));

    const headEl = content.querySelector('[data-pdf="thead"]');
    const head = headEl ? measure(headEl) : null;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const bodyWmm = pageW - 2 * margin;
    const bodyHmm = pageH - 2 * margin;

    const pxPerMm = content.offsetWidth / bodyWmm;
    const footerHeight = footer ? footer.offsetHeight : 0;
    const footerGap = footer ? 4 * pxPerMm : 0;
    const bodyHeight = bodyHmm * pxPerMm;
    const available = bodyHeight - footerHeight - footerGap;

    const slices = paginate(units, content.offsetHeight, available, head);

    // ── Composition de chaque page ─────────────────────────────────────────
    const s = contentCanvas.width / content.offsetWidth;
    const width = contentCanvas.width;

    slices.forEach((slice, index) => {
      const page = document.createElement('canvas');
      page.width = width;
      page.height = Math.round(bodyHeight * s);
      const ctx = page.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, page.width, page.height);

      let y = 0;
      if (slice.repeatHead && head) {
        const h = (head.bottom - head.top) * s;
        ctx.drawImage(contentCanvas, 0, head.top * s, width, h, 0, 0, width, h);
        y += h;
      }

      const h = (slice.end - slice.start) * s;
      if (h > 0) {
        ctx.drawImage(contentCanvas, 0, slice.start * s, width, h, 0, y, width, h);
      }

      if (footerCanvas) {
        const fh = footerCanvas.height * (width / footerCanvas.width);
        ctx.drawImage(footerCanvas, 0, 0, footerCanvas.width, footerCanvas.height,
          0, page.height - fh, width, fh);
      }

      if (index > 0) pdf.addPage();
      // JPEG et non PNG : une page A4 capturée à l'échelle 2 pèse 8 Mo en
      // PNG, 300 Ko en JPEG, sans différence lisible à l'impression.
      pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, bodyWmm, bodyHmm);
    });

    pdf.save(`${filename}.pdf`);
  }
}
