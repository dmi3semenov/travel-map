const R = 6371; // Earth radius in km

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function haversineDistance(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function computeBearing(from, to) {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Total length of a polyline (array of {lat, lng} points) in km
 */
export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Interpolate position along a path at progress 0..1
 * Returns { lat, lng } and bearing
 */
export function interpolateAlongPath(points, progress) {
  if (!points || points.length === 0) return null;
  if (points.length === 1) return { pos: points[0], bearing: 0 };
  if (progress <= 0) return { pos: points[0], bearing: computeBearing(points[0], points[1]) };
  if (progress >= 1) {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    return { pos: last, bearing: computeBearing(prev, last) };
  }

  // Compute cumulative distances
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1] + haversineDistance(points[i - 1], points[i]));
  }
  const total = distances[distances.length - 1];
  const target = progress * total;

  // Find segment
  let segIdx = 0;
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= target) {
      segIdx = i - 1;
      break;
    }
  }

  const segStart = distances[segIdx];
  const segEnd = distances[segIdx + 1];
  const t = segEnd === segStart ? 0 : (target - segStart) / (segEnd - segStart);

  const p0 = points[segIdx];
  const p1 = points[segIdx + 1];

  return {
    pos: {
      lat: p0.lat + t * (p1.lat - p0.lat),
      lng: p0.lng + t * (p1.lng - p0.lng),
    },
    bearing: computeBearing(p0, p1),
  };
}

/**
 * Fetch road route from OSRM (OpenStreetMap Routing Machine - free, no API key)
 * profile: 'driving' | 'foot' | 'cycling'
 * Returns array of {lat, lng} points or null on failure
 */
export async function fetchOSRMRoute(from, to, profile = 'driving') {
  try {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;
    const raw = data.routes[0].geometry.coordinates;
    const pts = raw.map(([lng, lat]) => ({ lat, lng }));
    // Decimate if too many points (keep ~500 for performance)
    return decimatePoints(pts, 500);
  } catch {
    return null;
  }
}

/**
 * Reduce point count by keeping every Nth point (simple equidistant sampling)
 */
function decimatePoints(points, maxCount) {
  if (points.length <= maxCount) return points;
  const step = points.length / maxCount;
  const result = [];
  for (let i = 0; i < maxCount - 1; i++) {
    result.push(points[Math.round(i * step)]);
  }
  result.push(points[points.length - 1]); // always include last point
  return result;
}

/**
 * Compute great circle arc points between two lat/lng points
 */
export function computeArcPoints(from, to, numPoints = 80) {
  try {
    const arcLib = window._arcLib;
    if (!arcLib) return [from, to];
    const GreatCircle = arcLib.GreatCircle || arcLib.default?.GreatCircle;
    if (!GreatCircle) return [from, to];
    const gc = new GreatCircle(
      { x: from.lng, y: from.lat },
      { x: to.lng, y: to.lat }
    );
    const arc = gc.Arc(numPoints);
    const points = arc.geometries.flatMap(g =>
      g.coords.map(([lng, lat]) => ({ lat, lng }))
    );
    return points.length > 0 ? points : [from, to];
  } catch {
    return [from, to];
  }
}
