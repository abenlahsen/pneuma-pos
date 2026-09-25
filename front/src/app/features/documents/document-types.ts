import type { DocumentType } from '../../shared/document-print/document-print.component';

/**
 * Les types qu'imprime `/documents/:type/:id/print`. Fichier à part, sans
 * dépendance lourde : la garde de route l'importe statiquement, et importer
 * la page elle-même annulerait son chargement paresseux.
 */
export const DOCUMENT_TYPES: readonly DocumentType[] = ['sale', 'purchase', 'service_order'];

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** La permission de lecture qu'exige chaque type. */
export const DOCUMENT_PERMISSIONS: Record<DocumentType, string> = {
  sale: 'view sales',
  purchase: 'view purchases',
  service_order: 'view service-orders',
};
