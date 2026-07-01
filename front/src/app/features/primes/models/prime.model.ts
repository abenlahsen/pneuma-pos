export interface PrimeRow {
  commercial_id: number | null;
  commercial_name: string;
  sale_tyres: number;
  so_tyres: number;
  total_tyres: number;
  prime_per_tyre: number;
  prime_total: number;
}

export interface PrimeSummary {
  total_primes: number;
  total_commerciaux: number;
}

export interface PrimesResponse {
  year: number;
  month: number;
  prime_threshold: number;
  shop_total_tyres: number;
  prime_eligible: boolean;
  summary: PrimeSummary;
  data: PrimeRow[];
}
