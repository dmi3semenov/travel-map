import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import './styles/sidebar.css';
import './styles/map.css';

import L from 'leaflet';
import * as Arc from 'arc';

import { initMap } from './map/map-init.js';
import { store } from './state/store.js';
import { createWaypointMarker, removeWaypointMarker, updateAllMarkerNumbers } from './map/markers.js';
import { buildRouteForSegment, removeRouteForSegment } from './map/routes.js';
import { AnimationEngine } from './animation/engine.js';
import { initSidebar } from './ui/sidebar.js';
import { initControls } from './ui/controls.js';
import { saveCurrentRoute, loadCurrentRoute } from './utils/storage.js';

// Make arc library globally accessible for geo.js
window._arcLib = Arc;

// Fix Leaflet default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Init map
const map = initMap();

// Init animation engine
const engine = new AnimationEngine(map);

// Init UI
initSidebar();
initControls(engine);

// --- Map click handler ---
let addingPoint = false;
const btnAddPoint = document.getElementById('btn-add-point');
const addingOverlay = document.getElementById('adding-point-overlay');

btnAddPoint.addEventListener('click', () => {
  addingPoint = !addingPoint;
  if (addingPoint) {
    btnAddPoint.classList.add('active');
    addingOverlay.classList.remove('hidden');
    map.getContainer().style.cursor = 'crosshair';
  } else {
    cancelAddingPoint();
  }
});

function cancelAddingPoint() {
  addingPoint = false;
  btnAddPoint.classList.remove('active');
  addingOverlay.classList.add('hidden');
  map.getContainer().style.cursor = '';
}

map.on('click', (e) => {
  if (!addingPoint) return;

  const latlng = { lat: e.latlng.lat, lng: e.latlng.lng };
  const name = prompt('Название города:', '') || `Точка ${store.getWaypoints().length + 1}`;

  store.addWaypoint(name.trim() || `Точка ${store.getWaypoints().length}`, latlng);
  cancelAddingPoint();
});

// --- Store event handlers ---
store.subscribe('waypoint:added', ({ waypointId }) => {
  const waypoints = store.getWaypoints();
  const wp = store.getWaypointById(waypointId);
  const idx = waypoints.findIndex(w => w.id === waypointId);
  createWaypointMarker(map, wp, idx + 1);
  updateAllMarkerNumbers(map);
  fitMapBounds();
  resetAnimationIfNeeded();
});

store.subscribe('waypoint:removed', ({ waypointId }) => {
  removeWaypointMarker(waypointId);
  updateAllMarkerNumbers(map);
  fitMapBounds();
  resetAnimationIfNeeded();
});

store.subscribe('waypoint:updated', ({ waypointId }) => {
  updateAllMarkerNumbers(map);
  resetAnimationIfNeeded();
});

store.subscribe('segment:added', ({ segmentId }) => {
  buildRouteForSegment(map, segmentId);
});

store.subscribe('segment:recalculate', ({ segmentId }) => {
  buildRouteForSegment(map, segmentId);
  resetAnimationIfNeeded();
});

store.subscribe('segment:removing', ({ segmentId }) => {
  removeRouteForSegment(segmentId);
});

store.subscribe('cleared', () => {
  engine.reset();
  fitMapBounds();
});

// --- Helpers ---
function fitMapBounds() {
  const waypoints = store.getWaypoints();
  if (waypoints.length === 0) return;
  if (waypoints.length === 1) {
    map.setView([waypoints[0].latlng.lat, waypoints[0].latlng.lng], 6, { animate: true });
    return;
  }
  const bounds = L.latLngBounds(waypoints.map(w => [w.latlng.lat, w.latlng.lng]));
  map.fitBounds(bounds, { padding: [60, 60], animate: true });
}

function resetAnimationIfNeeded() {
  if (store.getAnimationState() !== 'idle') {
    engine.reset();
    showToast('Анимация сброшена');
  }
}

// --- Auto-save current route to localStorage ---
function autoSave() {
  saveCurrentRoute(store.getWaypoints(), store.getSegments());
}
store.subscribe('waypoint:added', autoSave);
store.subscribe('waypoint:removed', autoSave);
store.subscribe('waypoint:updated', autoSave);
store.subscribe('segment:recalculate', autoSave);
store.subscribe('cleared', autoSave);

// Restore last session on load
const saved = loadCurrentRoute();
if (saved && saved.waypoints.length > 0) {
  store.loadRoute(saved);
}

// Clear button
document.getElementById('btn-clear').addEventListener('click', () => {
  if (store.getWaypoints().length === 0) return;
  if (confirm('Очистить весь маршрут?')) {
    store.clearAll();
  }
});

// --- Toast helper ---
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2000);
}

window.showToast = showToast;
