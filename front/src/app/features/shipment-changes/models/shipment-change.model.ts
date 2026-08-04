import { ShipmentChangeStatus } from '../../../core/constants/status.constants';

export type ShipmentChangeField =
  | 'payment_method'
  | 'recipient_name'
  | 'recipient_phone'
  | 'address'
  | 'city'
  | 'amount'
  | 'other';

export const SHIPMENT_CHANGE_FIELD_LABELS: Record<ShipmentChangeField, string> = {
  payment_method:  'Mode de paiement',
  recipient_name:  'Nom du destinataire',
  recipient_phone: 'Téléphone du destinataire',
  address:         'Adresse de livraison',
  city:            'Ville de destination',
  amount:          'Montant à encaisser',
  other:           'Autre',
};

export interface ShipmentChangeItem {
  id?: number;
  field: ShipmentChangeField;
  custom_label?: string | null;
  old_value: string;
  new_value: string;
  sort_order?: number;
}

export interface ShipmentChangeRequest {
  id: number;
  sale_id: number;
  sale?: {
    id: number;
    date: string;
    client: string;
    tracking_number: string | null;
    total_sale: string;
  } | null;
  carrier_id: number | null;
  carrier?: { id: number; name: string; phone?: string | null; email?: string | null } | null;
  shipment_number: string | null;
  date: string;
  status: ShipmentChangeStatus;
  sent_at: string | null;
  carrier_response: string | null;
  reason: string | null;
  items?: ShipmentChangeItem[];
  created_at?: string;
  updated_at?: string;
}

export interface ShipmentChangeRequestPayload {
  carrier_id?: number | null;
  shipment_number?: string | null;
  date: string;
  status?: ShipmentChangeStatus;
  reason?: string | null;
  items: ShipmentChangeItem[];
}

export interface PaginatedShipmentChangeRequests {
  data: ShipmentChangeRequest[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}
