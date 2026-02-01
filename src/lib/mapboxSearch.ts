import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { SearchResult, ReverseGeocodeResult } from '../types/mapbox';

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (!token) {
  console.warn('EXPO_PUBLIC_MAPBOX_TOKEN is not set');
}

const geocodingClient = token ? mbxGeocoding({ accessToken: token }) : null;

// Cache for reverse geocoding results to minimize API calls
const reverseGeocodeCache = new Map<string, ReverseGeocodeResult>();

// Type for Mapbox context items
interface MapboxContext {
  id: string;
  text: string;
}

/**
 * Forward geocoding: Convert addresses/place names to coordinates
 * @param query - The search query (address, place name, postcode)
 * @param proximity - Optional [longitude, latitude] to bias results near this location
 * @returns Array of search results with coordinates
 */
export async function searchPlaces(
  query: string,
  proximity?: [number, number]
): Promise<SearchResult[]> {
  if (!geocodingClient) {
    throw new Error('Mapbox geocoding client not initialized');
  }

  try {
    const response = await geocodingClient
      .forwardGeocode({
        query,
        countries: ['gb'], // Restrict to UK
        limit: 5,
        proximity: proximity ? [proximity[0], proximity[1]] : undefined,
        autocomplete: true,
      })
      .send();

    return response.body.features.map((feature: any) => ({
      id: feature.id,
      place_name: feature.place_name,
      center: feature.center,
      text: feature.text,
      place_type: feature.place_type || [],
      address: feature.properties?.address,
      context: feature.context,
    })) as SearchResult[];
  } catch (error) {
    console.error('Forward geocoding error:', error);
    throw error;
  }
}

/**
 * Reverse geocoding: Convert coordinates to human-readable addresses
 * @param longitude - Longitude coordinate
 * @param latitude - Latitude coordinate
 * @returns Formatted address information
 */
export async function reverseGeocode(
  longitude: number,
  latitude: number
): Promise<ReverseGeocodeResult> {
  if (!geocodingClient) {
    throw new Error('Mapbox geocoding client not initialized');
  }

  // Check cache first
  const cacheKey = `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey)!;
  }

  try {
    const response = await geocodingClient
      .reverseGeocode({
        query: [longitude, latitude],
        countries: ['gb'],
        limit: 1,
      })
      .send();

    if (response.body.features.length === 0) {
      throw new Error('No address found for coordinates');
    }

    const feature = response.body.features[0];
    const context = (feature.context || []) as MapboxContext[];
    
    // Extract postcode and city from context
    const postcodeContext = context.find((c) => c.id.startsWith('postcode'));
    const placeContext = context.find((c) => c.id.startsWith('place'));
    const regionContext = context.find((c) => c.id.startsWith('region'));

    const result: ReverseGeocodeResult = {
      address: feature.place_name,
      place_name: feature.place_name,
      postcode: postcodeContext?.text,
      city: placeContext?.text,
      region: regionContext?.text,
    };

    // Cache the result
    reverseGeocodeCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}

/**
 * Get place suggestions for autocomplete with session token management
 * @param query - The search query
 * @param sessionToken - Optional session token for billing optimization
 * @returns Array of search suggestions
 */
export async function getPlaceSuggestions(
  query: string,
  sessionToken?: string
): Promise<SearchResult[]> {
  // For now, use the same implementation as searchPlaces
  // Session tokens are mainly for the Search Box API which we're using via SDK
  return searchPlaces(query);
}
