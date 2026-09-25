import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanySettings } from '../../features/settings/models/company-settings.model';
import { montantEnLettres } from './montant-en-lettres';
import { issuerNameOf } from './issuer-name';

/**
 * L'imprimé de vente, d'achat et d'intervention — refonte 2b, étape 10,
 * maquette 19a.
 *
 * Ce composant n'est plus une modale : c'est la FEUILLE, et rien d'autre. La
 * barre d'actions, le chargement et le PDF vivent dans la page
 * `/documents/:type/:id/print` (features/documents), sur le modèle de la
 * lettre au transporteur (18c).
 *
 * Il ne décide rien du métier. Chaque variante — facture ou bon de vente,
 * bon d'achat, fiche d'intervention — arrive déjà résolue dans
 * `PrintDocument` par un constructeur pur (features/documents/print-builders) :
 * libellé du cadre de tête, case de réception, présence de la TVA, colonne
 * Remise autorisée ou non. La feuille ne fait que la mise en page et les
 * trois calculs qui en dépendent : la décomposition HT/TVA, le reste dû et le
 * montant en lettres.
 */

export type DocumentType = 'sale' | 'purchase' | 'service_order';

export interface PrintLine {
  label: string;
  /** Sous-ligne grise : dimension et DOT, « Prestation », « Pièce »… */
  details?: string | null;
  qty: number;
  unit_price: number;
  /** Remise de LIGNE, en pourcentage. Déjà appliquée dans `total`. */
  discount?: number;
  total: number;
}

/** Une case de la colonne gauche sous le tableau : transport et paiement. */
export interface PrintInfo {
  label: string;
  value: string;
  /** Chasse fixe — le n° de suivi, comme sur la lettre. */
  mono?: boolean;
}

export interface PrintDocument {
  type: DocumentType;
  /** « Facture », « Bon de vente », « Bon d'achat », « Fiche d'intervention ». */
  title: string;
  doc_number: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Complément de la ligne lieu et date : « vente n° 4182 », « BL n° 88 ». */
  reference_note?: string | null;
  party: {
    label: string;
    name: string;
    /** Adresse puis téléphone, une entrée par ligne affichée. */
    lines: string[];
    ice?: string | null;
  };
  /** Fiche d'intervention : le véhicule sous le client. */
  vehicle?: { description: string; plate?: string | null; mileage?: number | null } | null;
  lines: PrintLine[];
  /** Faux sur l'achat : pas de colonne Remise, même si une valeur traînait. */
  allow_discount_column: boolean;
  totals: {
    /** Somme des totaux de ligne, remises de ligne déjà déduites. */
    lines_total: number;
    /** Remise globale, en dirhams — jamais un pourcentage à ce stade. */
    discount_global?: number;
    /** Marchandise rendue au fournisseur, en dirhams nets. */
    returns?: number;
    /** Ce que le document réclame, TTC. C'est le chiffre dominant. */
    net: number;
    paid: number;
  };
  /** Vrai sur une facture : le net se décompose en hors-taxe et TVA. */
  vat_applies: boolean;
  /** « Net à payer », « Total dû au fournisseur ». */
  headline_label: string;
  info: PrintInfo[];
  notes?: string | null;
  /** « Arrêtée la présente facture », « Arrêté le présent bon d'achat »… */
  amount_in_words_intro: string;
  /** Le signataire, « nom · fonction ». */
  signatory?: string | null;
  /** « Reçu par le client », « Réceptionné par ». */
  receipt_box_title: string;
}

/** 17 556,48 — espace fine insécable en séparateur, comme la maquette. */
const MONEY = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(value: number): string {
  // L'espace fine insécable (U+202F) que produit Intl manque à certaines
  // polices de secours, et html2canvas la dessine alors en carré vide. Une
  // espace insécable ordinaire se rend partout.
  return MONEY.format(Number(value) || 0).replace(/[\u202f\u00a0]/g, '\u00a0');
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

@Component({
  selector: 'app-document-print',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-print.component.html',
  styleUrl: './document-print.component.scss',
})
export class DocumentPrintComponent {
  @Input({ required: true }) document!: PrintDocument;
  @Input() settings: CompanySettings | null = null;

  /**
   * Le logo n'a pas pu être chargé. `logo_url` est assemblée à partir du
   * chemin enregistré sans vérifier que le fichier existe : une image
   * supprimée du stockage donne une URL valide et un trou en haut du
   * document. On retombe alors sur la raison sociale en toutes lettres.
   */
  readonly logoFailed = signal(false);

  readonly money = formatMoney;

  /** Vrai seulement si une image est annoncée ET qu'elle s'est chargée. */
  showLogo(): boolean {
    return !!this.settings?.logo_url && !this.logoFailed();
  }

  /** Le type du document, tel que l'en-tête l'imprime en capitales. */
  getDocumentTitle(): string {
    return (this.document.title || 'Document').toUpperCase();
  }

  /**
   * La colonne Remise n'existe que si une ligne porte une remise, et jamais
   * sur un document qui l'interdit (l'achat).
   */
  hasDiscounts(): boolean {
    return this.document.allow_discount_column
      && this.document.lines.some(l => (Number(l.discount) || 0) > 0);
  }

  hasGlobalDiscount(): boolean {
    return (Number(this.document.totals.discount_global) || 0) > 0;
  }

  hasReturns(): boolean {
    return (Number(this.document.totals.returns) || 0) > 0;
  }

  /**
   * La décomposition HT / TVA d'une facture.
   *
   * Les ventes sont enregistrées TTC (décision du commit 206e33c) : le net
   * réclamé reste exactement celui de la vente, et le hors-taxe se
   * reconstitue ici. La TVA est la DIFFÉRENCE, pas un second arrondi : HT +
   * TVA retombe toujours au centime sur le net imprimé.
   *
   * `null` hors facture, ou tant que le taux n'est pas connu.
   */
  vat(): { rate: number; ht: number; tva: number } | null {
    if (!this.document.vat_applies) return null;
    const raw = this.settings?.vat_rate;
    if (raw === null || raw === undefined || raw === '') return null;
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate < 0) return null;

    const net = round2(this.document.totals.net);
    const ht = round2(net / (1 + rate / 100));
    return { rate, ht, tva: round2(net - ht) };
  }

  /** « 20 % », « 7 % », « 5,5 % ». */
  vatRateLabel(rate: number): string {
    return `${String(rate).replace('.', ',')} %`;
  }

  remaining(): number {
    return Math.max(0, round2(this.document.totals.net - this.document.totals.paid));
  }

  /**
   * L'état du paiement en capitales, sous le chiffre dominant. Il remplace le
   * badge vert / orange / rouge : lisible en noir et blanc, et calculé sur les
   * montants que la feuille imprime — jamais sur un drapeau qui pourrait les
   * contredire.
   */
  paymentState(): string {
    const remaining = this.remaining();
    if (remaining <= 0) return 'PAYÉ';
    if (round2(this.document.totals.paid) > 0) return `PARTIEL · RESTE DÛ ${formatMoney(remaining)}`;
    return 'NON PAYÉ';
  }

  amountInWords(): string {
    return montantEnLettres(this.document.totals.net);
  }

  /** « toutes taxes comprises » ne s'écrit que sur une facture. */
  amountInWordsSuffix(): string {
    return this.document.vat_applies ? ' toutes taxes comprises.' : '.';
  }

  fmtDate(value: string | null | undefined): string {
    if (!value) return '—';
    const [y, m, d] = value.slice(0, 10).split('-');
    return d && m && y ? `${d}/${m}/${y}` : value;
  }

  /** « Casablanca, le 02/07/2026 · vente n° 4182 ». */
  placeAndDate(): string {
    const city = this.settings?.city;
    const date = this.fmtDate(this.document.date);
    const place = city ? `${city}, le ${date}` : `Le ${date}`;
    return this.document.reference_note ? `${place} · ${this.document.reference_note}` : place;
  }

  /** L'émetteur tel qu'il s'imprime — voir issuerNameOf(). */
  issuerName(): string {
    return issuerNameOf(this.settings);
  }

  /** L'émetteur sous le logo : raison sociale et adresse, puis contact. */
  issuerLines(): string[] {
    const s = this.settings;
    if (!s) return [];
    const first = [this.issuerName(), s.address, s.city].filter(Boolean).join(' · ');
    const second = [s.phone, s.email].filter(Boolean).join(' · ');
    return [first, second].filter(Boolean);
  }

  /** Le pied de page légal : raison sociale et identifiants. */
  legalMentions(): string[] {
    const s = this.settings;
    if (!s) return [];
    return [
      this.issuerName(),
      s.rc ? `RC ${s.rc}` : '',
      s.ice ? `ICE ${s.ice}` : '',
      s.tax_id ? `IF ${s.tax_id}` : '',
      s.cnss ? `CNSS ${s.cnss}` : '',
      s.patente ? `Patente ${s.patente}` : '',
    ].filter(Boolean);
  }

  qty(value: number): string {
    return String(Number(value) || 0).replace('.', ',');
  }

  pct(value: number | undefined): string {
    return `${String(Number(value) || 0).replace('.', ',')} %`;
  }
}
