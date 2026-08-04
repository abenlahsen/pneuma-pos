export const SALE_STATUSES = ['EN COURS', 'LIVRE', 'MONTE', 'TERMINEE', 'ANNULE'] as const;
export type SaleStatus = typeof SALE_STATUSES[number];
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  'EN COURS': 'En cours',
  'LIVRE':    'Livrée',
  'MONTE':    'Montée',
  'TERMINEE': 'Terminée',
  'ANNULE':   'Annulée',
};

export const PURCHASE_STATUSES = ['EN COURS', 'RECU', 'TERMINE', 'ANNULE', 'RETOUR'] as const;
export type PurchaseStatus = typeof PURCHASE_STATUSES[number];
export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  'EN COURS': 'En cours',
  'RECU':     'Reçu',
  'TERMINE':  'Terminé',
  'ANNULE':   'Annulé',
  'RETOUR':   'Retour',
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
