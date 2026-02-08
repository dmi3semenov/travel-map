/**
 * Top-down SVG icons, all pointing NORTH (up).
 * CSS rotate(bearing) will correctly orient them in direction of travel.
 */
const TRANSPORT_SVG = {
  // Airplane silhouette from above, nose at top
  plane: `<svg viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="16" rx="2" ry="12"/>
    <path d="M16 12 L2 18 L6 18 L16 15 L26 18 L30 18 Z"/>
    <path d="M13 26 L16 24 L19 26 Z"/>
  </svg>`,

  // Car top-down, front at top
  car: `<svg viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="4" width="12" height="24" rx="5"/>
    <rect x="11" y="6" width="10" height="6" rx="2" fill="white" opacity="0.4"/>
    <rect x="11" y="21" width="10" height="5" rx="2" fill="white" opacity="0.3"/>
    <rect x="9" y="8" width="2" height="4" rx="1" opacity="0.6"/>
    <rect x="21" y="8" width="2" height="4" rx="1" opacity="0.6"/>
    <rect x="9" y="20" width="2" height="4" rx="1" opacity="0.6"/>
    <rect x="21" y="20" width="2" height="4" rx="1" opacity="0.6"/>
  </svg>`,

  // Bus top-down, front at top
  bus: `<svg viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="3" width="16" height="26" rx="3"/>
    <rect x="9" y="4" width="14" height="5" rx="2" fill="white" opacity="0.4"/>
    <rect x="10" y="12" width="5" height="4" rx="1" fill="white" opacity="0.3"/>
    <rect x="17" y="12" width="5" height="4" rx="1" fill="white" opacity="0.3"/>
    <rect x="10" y="18" width="5" height="4" rx="1" fill="white" opacity="0.3"/>
    <rect x="17" y="18" width="5" height="4" rx="1" fill="white" opacity="0.3"/>
    <rect x="7" y="5" width="2" height="5" rx="1" opacity="0.5"/>
    <rect x="23" y="5" width="2" height="5" rx="1" opacity="0.5"/>
  </svg>`,

  // Train top-down, front at top
  train: `<svg viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="3" width="14" height="26" rx="4"/>
    <rect x="10" y="4" width="12" height="4" rx="2" fill="white" opacity="0.5"/>
    <line x1="16" y1="10" x2="16" y2="26" stroke="white" stroke-width="1" opacity="0.3"/>
    <rect x="10" y="10" width="5" height="3" rx="1" fill="white" opacity="0.2"/>
    <rect x="17" y="10" width="5" height="3" rx="1" fill="white" opacity="0.2"/>
    <rect x="10" y="16" width="5" height="3" rx="1" fill="white" opacity="0.2"/>
    <rect x="17" y="16" width="5" height="3" rx="1" fill="white" opacity="0.2"/>
    <rect x="10" y="22" width="5" height="3" rx="1" fill="white" opacity="0.2"/>
    <rect x="17" y="22" width="5" height="3" rx="1" fill="white" opacity="0.2"/>
  </svg>`,

  // Walking person, simplified arrow-person pointing up
  walking: `<svg viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="6" r="3"/>
    <path d="M16 10 L12 14 L10 22 L13 22 L15 17 L17 19 L17 22 L20 22 L18 15 L20 12 Z"/>
    <path d="M12 14 L9 18 M20 12 L23 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
};

// Emoji fallbacks for sidebar buttons
const EMOJI_ICONS = {
  plane: '✈️',
  bus: '🚌',
  car: '🚗',
  train: '🚆',
  walking: '🚶',
};

export const TRANSPORT_LABELS = {
  plane: 'Самолёт',
  bus: 'Автобус',
  car: 'Автомобиль',
  train: 'Поезд',
  walking: 'Пешком',
};

export const TRANSPORT_TYPES = ['plane', 'bus', 'car', 'train', 'walking'];

export function getTransportIcon(type) {
  return EMOJI_ICONS[type] || '🚶';
}

export function getTransportMarkerHTML(type) {
  const svg = TRANSPORT_SVG[type] || TRANSPORT_SVG.walking;
  return `<div class="transport-marker transport-${type}">${svg}</div>`;
}

export function createTransportMarkerIcon(type) {
  const L = window.L;
  return L.divIcon({
    html: getTransportMarkerHTML(type),
    className: 'transport-icon-wrapper',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/**
 * Directly updates the marker element's inner HTML.
 * More reliable than setIcon() which reuses DOM elements via Leaflet internals.
 */
export function updateTransportMarkerDOM(markerEl, type) {
  if (!markerEl) return;
  markerEl.innerHTML = getTransportMarkerHTML(type);
}
