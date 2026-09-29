export const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
/** Pastilles du filtre « Mode de paiement » (app-filter-pills), communes aux trois listes. */
export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((value) => ({ value, label: value }));

const METHOD_CLASS: Record<string, string> = {
  'Espèces': 'method-especes',
  'Chèque': 'method-cheque',
  'Virement': 'method-virement',
  'Effet': 'method-effet',
  'Carte bancaire': 'method-carte',
};

/** CSS modifier class for a payment-method badge; '' falls back to the neutral badge. */
export function paymentMethodClass(method: string): string {
  return METHOD_CLASS[method] ?? '';
}
