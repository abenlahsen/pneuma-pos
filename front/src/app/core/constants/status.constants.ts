export const SALE_STATUSES = ['EN COURS', 'LIVRE', 'MONTE', 'TERMINEE', 'ANNULE'] as const;
export type SaleStatus = typeof SALE_STATUSES[number];
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  'EN COURS': 'En cours',
  'LIVRE':    'Livrée',
  'MONTE':    'Montée',
  'TERMINEE': 'Terminée',
  'ANNULE':   'Annulée',
};

/**
 * Allowed next statuses from each status — one step forward or one step
 * back, never a direct jump from EN COURS to TERMINEE. Mirrors
 * SaleStatus::allowedTransitions() on the backend (source of truth
 * duplicated consciously, like the rest of this file).
 */
export const SALE_STATUS_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  'EN COURS': ['LIVRE', 'MONTE', 'ANNULE'],
  'LIVRE':    ['EN COURS', 'MONTE', 'TERMINEE'],
  'MONTE':    ['EN COURS', 'LIVRE', 'TERMINEE'],
  'TERMINEE': ['LIVRE', 'MONTE'],
  'ANNULE':   ['EN COURS'],
};

export const PURCHASE_STATUSES = ['EN COURS', 'RECU', 'TERMINE', 'ANNULE'] as const;
export type PurchaseStatus = typeof PURCHASE_STATUSES[number];
export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  'EN COURS': 'En cours',
  'RECU':     'Reçu',
  'TERMINE':  'Terminé',
  'ANNULE':   'Annulé',
};

/** Mirrors PurchaseStatus::allowedTransitions() on the backend. */
export const PURCHASE_STATUS_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  'EN COURS': ['RECU', 'ANNULE'],
  'RECU':     ['EN COURS', 'TERMINE'],
  'TERMINE':  ['RECU'],
  'ANNULE':   ['EN COURS'],
};

export const SERVICE_ORDER_STATUSES = ['EN COURS', 'TERMINE', 'ANNULE'] as const;
export type ServiceOrderStatus = typeof SERVICE_ORDER_STATUSES[number];
export const SERVICE_ORDER_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  'EN COURS': 'En cours',
  'TERMINE':  'Terminée',
  'ANNULE':   'Annulée',
};

export const PAYMENT_STATUSES = ['NON PAYE', 'PAYE', 'PARTIEL'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  'NON PAYE': 'Non payé',
  'PAYE':     'Payé',
  'PARTIEL':  'Partiel',
};

export const CLIENT_CATEGORIES = ['Particulier', 'Entreprise'] as const;
export type ClientCategory = typeof CLIENT_CATEGORIES[number];

export const SHIPMENT_CHANGE_STATUSES = ['BROUILLON', 'ENVOYEE', 'ACCEPTEE', 'REFUSEE'] as const;
export type ShipmentChangeStatus = typeof SHIPMENT_CHANGE_STATUSES[number];
export const SHIPMENT_CHANGE_STATUS_LABELS: Record<ShipmentChangeStatus, string> = {
  'BROUILLON': 'Brouillon',
  'ENVOYEE':   'Envoyée',
  'ACCEPTEE':  'Acceptée',
  'REFUSEE':   'Refusée',
};
