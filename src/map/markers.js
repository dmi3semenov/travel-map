import L from 'leaflet';
import { store } from '../state/store.js';

const markerMap = new Map(); // waypointId -> L.Marker

export function createWaypointMarker(map, wp, index) {
  const icon = L.divIcon({
    html: `<div class="wp-marker"><div class="wp-marker-inner">${index}</div></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const marker = L.marker([wp.latlng.lat, wp.latlng.lng], {
    icon,
    draggable: true,
  });

  marker.bindPopup(`<div class="wp-popup"><strong>${wp.name}</strong><span>Точка ${index}</span></div>`);

  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    store.updateWaypointLatLng(wp.id, { lat: pos.lat, lng: pos.lng });
  });

  marker.addTo(map);
  markerMap.set(wp.id, marker);

  return marker;
}

export function removeWaypointMarker(waypointId) {
  const marker = markerMap.get(waypointId);
  if (marker) {
    marker.remove();
    markerMap.delete(waypointId);
  }
}

export function updateAllMarkerNumbers(map) {
  const waypoints = store.getWaypoints();
  waypoints.forEach((wp, idx) => {
    const marker = markerMap.get(wp.id);
    if (marker) {
      const icon = L.divIcon({
        html: `<div class="wp-marker"><div class="wp-marker-inner">${idx + 1}</div></div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });
      marker.setIcon(icon);
      marker.setPopupContent(
        `<div class="wp-popup"><strong>${wp.name}</strong><span>Точка ${idx + 1}</span></div>`
      );
    }
  });
}

export function updateMarkerPopup(waypointId) {
  const marker = markerMap.get(waypointId);
  const wp = store.getWaypointById(waypointId);
  if (marker && wp) {
    const waypoints = store.getWaypoints();
    const idx = waypoints.findIndex(w => w.id === waypointId);
    marker.setPopupContent(
      `<div class="wp-popup"><strong>${wp.name}</strong><span>Точка ${idx + 1}</span></div>`
    );
  }
}
