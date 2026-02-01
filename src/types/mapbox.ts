export interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number]; // [longitude, latitude]
  text: string;
  place_type: string[];
  address?: string;
  postcode?: string;
  context?: Array<{ id: string; text: string }>;
}

export interface ReverseGeocodeResult {
  address: string;
  place_name: string;
  postcode?: string;
  city?: string;
  region?: string;
}
