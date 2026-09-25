import { Sale, SaleItem } from '../../core/models/sale.model';
import { Purchase, PurchaseItem } from '../../core/models/purchase.model';
import { ServiceItem, ServiceOrder } from '../../core/models/service-order.model';
import {
  PrintDocument,
  PrintInfo,
  PrintLine,
} from '../../shared/document-print/document-print.component';

/**
 * De l'entité au document imprimé — refonte 2b, étape 10.
 *
 * Fonctions pures : c'est ici, et non dans la feuille, que se décide chaque
 * variante (facture ou bon de vente, bon d'achat, fiche d'intervention). La
 * page `/documents/:type/:id/print` recharge l'entité par son `show` et passe
 * le résultat à la feuille ; rien ne dépend donc de l'écran d'où l'on vient,
 * et le document reste adressable et rechargeable.
 *
 * Ce que ces fonctions refusent de faire : inventer. Un champ que le modèle ne
 * porte pas (ICE du client ou du fournisseur, date de réception d'un achat,
 * numéro de facture distinct du numéro de vente) n'apparaît pas.
 */

// ── Outils communs ──────────────────────────────────────────────────────────

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : value;
}

/** Ne garde que les lignes non vides. */
function compact(lines: (string | null | undefined)[]): string[] {
  return lines.map(l => text(l)).filter(Boolean);
}

/** « Km 8, route de Rabat, Casablanca » — l'adresse, suivie de la ville si elle n'y est pas déjà. */
function addressLine(address: unknown, city: unknown): string {
  const a = text(address);
  const c = text(city);
  if (!a) return c;
  if (!c || a.toLowerCase().includes(c.toLowerCase())) return a;
  return `${a}, ${c}`;
}

/** Les rôles Spatie sont en anglais ; la signature est en français. */
const ROLE_LABELS: Record<string, string> = {
  Administrator: 'administrateur',
  Manager: 'responsable',
  Commercial: 'commercial',
  Driver: 'chauffeur',
};

export function signatoryOf(person: { name?: string | null; role?: string | null } | null | undefined): string | null {
  const name = text(person?.name);
  if (!name) return null;
  const role = text(person?.role);
  if (!role) return name;
  return `${name} · ${ROLE_LABELS[role] ?? role.toLowerCase()}`;
}

function info(label: string, value: unknown, mono = false): PrintInfo | null {
  const v = text(value);
  return v ? { label, value: v, ...(mono ? { mono } : {}) } : null;
}

function infos(items: (PrintInfo | null)[]): PrintInfo[] {
  return items.filter((i): i is PrintInfo => i !== null);
}

// ── Désignation d'un produit ────────────────────────────────────────────────

function productOf(item: any): any {
  return item?.linkedProduct || item?.linked_product || item?.product || null;
}

/** « Michelin Primacy 4 » pour un pneu, la référence sinon. */
function productLabel(product: any, fallback: string): string {
  if (product?.type !== 'tyre') return text(product?.reference) || fallback;
  const parts = compact([product.brand?.name, product.profile]);
  return parts.join(' ') || text(product?.reference) || fallback;
}

/**
 * La sous-ligne grise : « 205/55R16 91V · DOT 2425 » pour un pneu,
 * « Prestation » pour un service, le profil pour une pièce.
 */
function productDetails(product: any, dot?: string | null): string | null {
  if (product?.type === 'service') return 'Prestation';
  if (product?.type !== 'tyre') return text(product?.profile) || null;

  const t = product?.tyre;
  const parts: string[] = [];
  if (t?.tire_width && t?.tire_height && t?.tire_diameter) {
    const indices = `${text(String(t.tire_load_index ?? ''))}${text(String(t.tire_speed_index ?? ''))}`;
    parts.push(`${t.tire_width}/${t.tire_height}R${t.tire_diameter}${indices ? ` ${indices}` : ''}`);
  }
  if (text(t?.tire_marking)) parts.push(text(t.tire_marking));
  if (text(dot)) parts.push(`DOT ${text(dot)}`);
  return parts.length ? parts.join(' · ') : null;
}

// ── Vente : facture ou bon de vente ─────────────────────────────────────────

export function saleLineTotal(item: SaleItem): number {
  if (item.total != null) return num(item.total);
  const discount = Math.max(0, Math.min(100, num(item.discount)));
  const unitPrice = num(item.selling_price ?? item.unit_price);
  return round2(unitPrice * num(item.quantity) * (1 - discount / 100));
}

/**
 * Une vente « avec facture » s'imprime en FACTURE, avec sa TVA ; une vente
 * sans facture en BON DE VENTE, sans TVA. Écrire « facture » et décomposer une
 * TVA sur une vente enregistrée sans facture serait un faux document.
 *
 * Il n'existe pas de numérotation de facture distincte : le numéro imprimé est
 * celui de la vente.
 */
export function buildSalePrint(sale: Sale): PrintDocument {
  const lines: PrintLine[] = (sale.items ?? []).map(item => {
    const product = productOf(item);
    return {
      label: productLabel(product, text(item.product_name) || `Produit #${item.product_id}`),
      details: productDetails(product, item.stock?.dot),
      qty: num(item.quantity),
      unit_price: num(item.selling_price ?? item.unit_price),
      discount: num(item.discount),
      total: saleLineTotal(item),
    };
  });

  const client = sale.linked_client;
  const net = num(sale.total_sale ?? sale.total);
  // `paid_amount` vient des allocations et fait foi. La somme de `payments`
  // n'est qu'un repli : elle ignore les règlements répartis.
  const paid = sale.paid_amount != null
    ? num(sale.paid_amount)
    : (sale.payments ?? []).reduce((sum, p) => sum + num(p.amount), 0);
  const invoice = !!sale.with_invoice;

  return {
    type: 'sale',
    title: invoice ? 'Facture' : 'Bon de vente',
    doc_number: `N° ${sale.id}`,
    date: sale.date,
    party: {
      label: 'Client',
      name: text(client?.name) || text(sale.client) || '—',
      lines: compact([
        addressLine(client?.address, client?.city ?? sale.city),
        text(client?.phone) || text(sale.client_phone),
      ]),
      ice: null,
    },
    lines,
    allow_discount_column: true,
    totals: {
      lines_total: round2(lines.reduce((sum, l) => sum + l.total, 0)),
      net,
      paid: round2(paid),
    },
    vat_applies: invoice,
    headline_label: 'Net à payer',
    info: infos([
      info('Transporteur', sale.carrier?.name),
      info('N° de suivi', sale.tracking_number, true),
      info('Livraison', fmtDate(sale.delivery_date)),
      info('Paiement', (sale.payment_methods ?? []).join(', ')),
      info('Partenaire', sale.partner?.name),
      info('Service', sale.service),
    ]),
    notes: text(sale.comments) || null,
    amount_in_words_intro: invoice ? 'Arrêtée la présente facture' : 'Arrêté le présent bon de vente',
    signatory: signatoryOf(sale.commercial),
    receipt_box_title: 'Reçu par le client',
  };
}

// ── Achat : bon d'achat ─────────────────────────────────────────────────────

function purchaseLineTotal(item: PurchaseItem): number {
  return round2(num(item.total_price ?? num(item.unit_price) * num(item.quantity)));
}

/**
 * Le tiers est le fournisseur, le cadre de tête porte ce qui lui est dû.
 *
 * Pas de colonne Remise : un achat n'a pas de remise de ligne. Sa remise est
 * globale et EN POURCENTAGE (`purchases.discount`) — elle est convertie ici en
 * dirhams, la différence entre le total des lignes et le net.
 *
 * « Total dû » et « déjà payé » sont ceux de `show` : retours déduits,
 * remboursements retranchés — les chiffres que compare le statut de paiement.
 */
export function buildPurchasePrint(purchase: Purchase): PrintDocument {
  const lines: PrintLine[] = (purchase.items ?? []).map(item => {
    const product = productOf(item);
    return {
      label: productLabel(product, `Produit #${item.product_id}`),
      details: productDetails(product),
      qty: num(item.quantity),
      unit_price: num(item.unit_price),
      total: purchaseLineTotal(item),
    };
  });

  const linesTotal = purchase.total_price != null
    ? num(purchase.total_price)
    : round2(lines.reduce((sum, l) => sum + l.total, 0));
  const netAmount = num(purchase.net_amount ?? linesTotal);
  const net = purchase.effective_net_amount != null ? num(purchase.effective_net_amount) : netAmount;
  const discount = num(purchase.discount) > 0 ? round2(linesTotal - netAmount) : 0;
  const returns = round2(netAmount - net);
  const paid = purchase.paid_amount != null
    ? num(purchase.paid_amount)
    : (purchase.payments ?? []).reduce((sum, p) => sum + num(p.amount), 0);

  const supplier = purchase.supplier;
  const reference = compact([
    purchase.bl_number ? `BL n° ${text(purchase.bl_number)}` : '',
    purchase.invoice_number ? `facture fournisseur n° ${text(purchase.invoice_number)}` : '',
  ]).join(' · ');

  return {
    type: 'purchase',
    title: "Bon d'achat",
    doc_number: `N° ${purchase.id}`,
    date: purchase.date,
    reference_note: reference || null,
    party: {
      label: 'Fournisseur',
      name: text(supplier?.name) || '—',
      lines: compact([
        supplier?.address,
        compact([supplier?.phone, supplier?.email]).join(' · '),
      ]),
      // Le modèle Supplier ne porte pas d'ICE.
      ice: null,
    },
    lines,
    allow_discount_column: false,
    totals: {
      lines_total: linesTotal,
      ...(discount > 0 ? { discount_global: discount } : {}),
      ...(returns > 0 ? { returns } : {}),
      net,
      paid: round2(paid),
    },
    vat_applies: false,
    headline_label: 'Total dû au fournisseur',
    info: infos([
      info('Paiement', (purchase.payment_methods ?? []).join(', ')),
    ]),
    notes: null,
    amount_in_words_intro: "Arrêté le présent bon d'achat",
    signatory: signatoryOf(purchase.commercial),
    receipt_box_title: 'Réceptionné par',
  };
}

// ── Intervention : fiche d'intervention ─────────────────────────────────────

function serviceLine(item: ServiceItem): PrintLine {
  if (item.item_type === 'part') {
    return {
      label: text(item.product_name) || `Pièce #${item.product_id}`,
      details: compact(['Pièce', item.product_reference]).join(' · '),
      qty: num(item.quantity ?? 1),
      unit_price: num(item.unit_price),
      total: num(item.line_total),
    };
  }
  return {
    label: text(item.service_type) || 'Prestation',
    details: compact(['Prestation', item.description]).join(' · '),
    qty: num(item.quantity ?? 1),
    unit_price: num(item.labor_cost),
    total: num(item.line_total),
  };
}

/**
 * Prestations et pièces dans le même tableau, distinguées par leur
 * sous-ligne. Le véhicule et le kilométrage sous le client, la plaque en
 * chasse fixe. La remise de l'ordre est un pourcentage, convertie en dirhams.
 */
export function buildServiceOrderPrint(order: ServiceOrder): PrintDocument {
  const lines = (order.items ?? []).map(serviceLine);
  const linesTotal = num(order.total_amount);
  const net = num(order.net_amount);
  const discount = num(order.discount) > 0 ? round2(linesTotal - net) : 0;
  const paid = order.total_paid != null
    ? num(order.total_paid)
    : ((order as any).payments ?? []).reduce((sum: number, p: any) => sum + num(p.amount), 0);

  const v = order.vehicle_data;
  const vehicleName = v ? compact([v.brand, v.model_name]).join(' ') : text(order.vehicle);
  const methods = Array.from(new Set(
    ((order as any).payments ?? []).map((p: any) => text(p.method)).filter(Boolean),
  )) as string[];
  const client = order.client_record;

  return {
    type: 'service_order',
    title: "Fiche d'intervention",
    doc_number: `N° ${order.id}`,
    date: order.date,
    party: {
      label: 'Client',
      name: text(client?.name) || '—',
      lines: compact([addressLine(client?.address, client?.city), client?.phone]),
      ice: null,
    },
    vehicle: vehicleName || v?.plate
      ? { description: vehicleName || 'Véhicule', plate: v?.plate ?? null, mileage: order.mileage ?? null }
      : null,
    lines,
    allow_discount_column: false,
    totals: {
      lines_total: linesTotal,
      ...(discount > 0 ? { discount_global: discount } : {}),
      net,
      paid: round2(paid),
    },
    vat_applies: false,
    headline_label: 'Net à payer',
    info: infos([info('Paiement', methods.join(', '))]),
    notes: text(order.notes) || null,
    amount_in_words_intro: "Arrêtée la présente fiche d'intervention",
    signatory: signatoryOf(order.commercial),
    receipt_box_title: 'Reçu par le client',
  };
}
