/**
 * Search cities using Nominatim (OpenStreetMap geocoding) - free, no API key
 */
export async function searchCity(query) {
  if (!query || query.length < 2) return [];
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '6',
      addressdetails: '1',
      'accept-language': 'ru',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'ru' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(item => {
      const addr = item.address || {};
      const name =
        addr.city || addr.town || addr.village || addr.county || addr.state || item.name;
      const country = addr.country || '';
      return {
        name,
        displayName: country ? `${name}, ${country}` : name,
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    }).filter(r => r.name);
  } catch {
    return [];
  }
}
