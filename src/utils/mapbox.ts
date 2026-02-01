import { SearchResult } from '../types/mapbox';

/**
 * Format Mapbox search results for display
 */
export function formatSearchResult(result: SearchResult): string {
  return result.place_name || result.text || '';
}

/**
 * Extract UK postcode from address
 * UK postcode format: AA9A 9AA or AA99 9AA, etc.
 */
export function extractPostcode(address: string): string | null {
  const postcodeRegex = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i;
  const match = address.match(postcodeRegex);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Check if coordinates are within UK bounds
 * UK approximate bounds: lat 49.9 to 60.9, lng -8.2 to 1.8
 */
export function isUKLocation(longitude: number, latitude: number): boolean {
  return latitude >= 49.9 && latitude <= 60.9 && longitude >= -8.2 && longitude <= 1.8;
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(longitude: number, latitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
