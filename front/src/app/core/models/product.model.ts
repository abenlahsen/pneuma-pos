import { Brand } from './brand.model';

export interface Product {
  id: number;
  profile: string | null;
  reference: string | null;
  type: 'tyre' | 'part';
  brand_id: number | null;
  brand?: Brand;
  description: string | null;
  unit: string;
  is_active: boolean;
  // Tyre-specific
  tire_width: number | null;
  tire_height: number | null;
  tire_diameter: number | null;
  tire_load_index: string | null;
  tire_speed_index: string | null;
  tire_season: 'summer' | 'winter' | 'all_season' | null;
  tire_runflat: boolean;
  tire_reinforced: boolean;
  tire_marking: string | null;
  eu_fuel: string | null;
  eu_wet_grip: string | null;
  eu_noise_db: number | null;
  eu_noise_class: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductPayload {
  profile?: string | null;
  reference?: string | null;
  type: 'tyre' | 'part';
  brand_id?: number | null;
  description?: string | null;
  unit?: string;
  is_active?: boolean;
  // Tyre-specific
  tire_width?: number | null;
  tire_height?: number | null;
  tire_diameter?: number | null;
  tire_load_index?: string | null;
  tire_speed_index?: string | null;
  tire_season?: string | null;
  tire_runflat?: boolean;
  tire_reinforced?: boolean;
  tire_marking?: string | null;
  eu_fuel?: string | null;
  eu_wet_grip?: string | null;
  eu_noise_db?: number | null;
  eu_noise_class?: string | null;
}

export interface ProductFilters {
  brands: { id: number; name: string }[];
  types: string[];
  seasons: string[];
  units: string[];
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  last_page: number;
  per_page: number;
  total: number;
}
