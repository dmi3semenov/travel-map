import L from 'leaflet';
import { store } from '../state/store.js';
import { computeArcPoints, fetchOSRMRoute } from '../utils/geo.js';

const ROUTE_STYLES = {
  plane: { color: '#3b82f6', weight: 2, dashArray: '8, 6', opacity: 0.8 },
  bus: { color: '#f59e0b', weight: 3, opacity: 0.85 },
  car: { color: '#10b981', weight: 3, opacity: 0.85 },
  train: { color: '#8b5cf6', weight: 3, opacity: 0.85 },
  walking: { color: '#ef4444', weight: 2, dashArray: '4, 7', opacity: 0.8 },
};

// OSRM profile mapping
const OSRM_PROFILE = {
  car: 'driving',
  bus: 'driving',
  walking: 'foot',
};

// Simple in-memory cache: key → points[]
const routeCache = new Map();

function cacheKey(from, to, profile) {
  return `${from.lat.toFixed(4)},${from.lng.toFixed(4)}-${to.lat.toFixed(4)},${to.lng.toFixed(4)}-${profile}`;
}

export async function buildRouteForSegment(map, segmentId) {
  const seg = store.getSegmentById(segmentId);
  if (!seg) return;

  // Remove old polyline
  if (seg.polyline) {
    seg.polyline.remove();
    store.setSegmentPolyline(segmentId, null);
  }

  const from = store.getWaypointById(seg.from);
  const to = store.getWaypointById(seg.to);
  if (!from || !to) return;

  let points = null;

  if (seg.transport === 'plane') {
    points = computeArcPoints(from.latlng, to.latlng, 80);
  } else if (OSRM_PROFILE[seg.transport]) {
    const profile = OSRM_PROFILE[seg.transport];
    const key = cacheKey(from.latlng, to.latlng, profile);

    if (routeCache.has(key)) {
      points = routeCache.get(key);
    } else {
      // Show dashed placeholder while loading
      const placeholder = L.polyline(
        [[from.latlng.lat, from.latlng.lng], [to.latlng.lat, to.latlng.lng]],
        { color: ROUTE_STYLES[seg.transport].color, weight: 2, dashArray: '4,4', opacity: 0.4 }
      ).addTo(map);
      store.setSegmentPolyline(segmentId, placeholder);

      const fetched = await fetchOSRMRoute(from.latlng, to.latlng, profile);
      points = fetched || [from.latlng, to.latlng];
      routeCache.set(key, points);

      // Remove placeholder before drawing real route
      const stillSeg = store.getSegmentById(segmentId);
      if (stillSeg && stillSeg.polyline === placeholder) {
        placeholder.remove();
        store.setSegmentPolyline(segmentId, null);
      } else {
        // Segment was changed/removed while waiting
        return;
      }
    }
  } else {
    // Train: straight line (no road routing)
    points = [from.latlng, to.latlng];
  }

  store.setSegmentPathPoints(segmentId, points);

  const latlngs = points.map(p => [p.lat, p.lng]);
  const style = ROUTE_STYLES[seg.transport] || ROUTE_STYLES.plane;
  const polyline = L.polyline(latlngs, style).addTo(map);
  store.setSegmentPolyline(segmentId, polyline);
}

export function removeRouteForSegment(segmentId) {
  const seg = store.getSegmentById(segmentId);
  if (seg && seg.polyline) {
    seg.polyline.remove();
    store.setSegmentPolyline(segmentId, null);
  }
}
