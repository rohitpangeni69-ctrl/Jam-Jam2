import * as geofire from 'geofire-common';

/**
 * Generates a geohash for a given location to enable efficient proximity queries
 * without expensive geospatial indexing.
 * 
 * @param lat Latitude
 * @param lng Longitude
 * @returns Geohash string
 */
export function getGeohash(lat: number, lng: number): string {
  return geofire.geohashForLocation([lat, lng]);
}

/**
 * Returns bounds for querying Firebase for locations within a specific radius.
 * 
 * @param center The center location [lat, lng]
 * @param radiusInM The radius to search within in meters
 * @returns Array of geohash bounds [start, end]
 */
export function getGeohashBounds(center: [number, number], radiusInM: number): string[][] {
  return geofire.geohashQueryBounds(center, radiusInM);
}

/**
 * Calculates the distance between two coordinates in kilometers.
 * Useful for filtering false positives after a geohash query.
 */
export function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return geofire.distanceBetween([lat1, lng1], [lat2, lng2]);
}
