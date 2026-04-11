import { Brand } from './brand.model';

export type ProductType = 'tyre' | 'part' | 'service';

export type PartCategory =
  | 'brakes'
  | 'lubricants'
  | 'engine'
  | 'suspension'
  | 'filters'
  | 'electrical'
  | 'body'
  | 'other';

export type ServiceCategory =
  | 'mechanical'
  | 'oil'
  | 'tires'
  | 'bodywork'
  | 'diagnostic'
  | 'other';

export interface ProductTyre {
  product_id: number;
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
}

export interface ProductPart {
  product_id: number;
  category: PartCategory;
  oem_reference: string | null;
  compatibility: string | null;
}

export interface ProductService {
  product_id: number;
  category: ServiceCategory;
  duration_minutes: number | null;
  selling_price: number | null;
}

export interface Product {
  id: number;
  profile: string | null;
  reference: string | null;
  type: ProductType;
  brand_id: number | null;
  brand?: Brand;
  description: string | null;
  unit: string;
  is_active: boolean;
  tyre?: ProductTyre | null;
  part?: ProductPart | null;
  service?: ProductService | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Payload sent to POST/PUT /api/products.
 * Flat shape: base fields + type-specific fields on the top level
 * (matches backend validationRules()).
 */
export interface ProductPayload {
  profile?: string | null;
  reference?: string | null;
  type: ProductType;
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

  // Part-specific
  part_category?: PartCategory | null;
  oem_reference?: string | null;
  compatibility?: string | null;

  // Service-specific
  service_category?: ServiceCategory | null;
  duration_minutes?: number | null;
  selling_price?: number | null;
}

export interface ProductFilters {
  brands: { id: number; name: string }[];
  types: string[];
  seasons: string[];
  part_categories: string[];
  service_categories: string[];
  units: string[];
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  last_page: number;
  per_page: number;
  total: number;
}
