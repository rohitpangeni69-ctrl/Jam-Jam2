export async function searchAddress(query: string) {
  if (!query || query.length < 3) return [];
  
  // Adding 'Nepal' to the query to prioritize local results
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Nepal')}&limit=5&addressdetails=1`
  );
  
  if (!response.ok) return [];
  return response.json();
}

export async function getRoute(start: [number, number], end: [number, number]) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Routing error or timeout:", error);
    return null;
  }
}
