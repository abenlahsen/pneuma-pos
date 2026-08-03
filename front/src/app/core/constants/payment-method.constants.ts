export const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

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
