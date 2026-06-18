export const SALE_STATUSES = ['EN COURS', 'LIVRE', 'MONTE', 'TERMINEE', 'ANNULE'] as const;
export type SaleStatus = typeof SALE_STATUSES[number];

export const PURCHASE_STATUSES = ['EN COURS', 'RECU', 'TERMINE', 'ANNULE', 'RETOUR'] as const;
export type PurchaseStatus = typeof PURCHASE_STATUSES[number];

export const PAYMENT_STATUSES = ['NON PAYE', 'PAYE', 'PARTIEL'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const CLIENT_CATEGORIES = ['Particulier', 'Entreprise'] as const;
export type ClientCategory = typeof CLIENT_CATEGORIES[number];
