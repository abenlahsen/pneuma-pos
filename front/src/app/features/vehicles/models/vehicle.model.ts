export interface Vehicle {
  id: number;
  client_id: number;
  plate: string;
  brand: string;
  model_name: string;
  circulation_month: number;
  circulation_year: number;
  vin?: string | null;
  notes?: string | null;
  is_active: boolean;
  display_name?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface VehiclePayload {
  plate: string;
  brand: string;
  model_name: string;
  circulation_month: number;
  circulation_year: number;
  vin?: string | null;
  notes?: string | null;
  is_active?: boolean;
}
