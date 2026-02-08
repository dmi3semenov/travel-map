import L from 'leaflet';

const TILE_LAYERS = {
  ru: {
    url: 'https://tiles.maps.sputnik.ru/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Sputnik',
    label: '🇷🇺 Русский',
  },
  en: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: '🌐 English',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    label: '🗺️ Local',
  },
};

export function initMap() {
  const map = L.map('map', {
    center: [30, 60],
    zoom: 3,
    zoomControl: true,
    worldCopyJump: true,
  });

  let currentLayer = null;

  function setTileLayer(key) {
    if (currentLayer) map.removeLayer(currentLayer);
    const cfg = TILE_LAYERS[key] || TILE_LAYERS.en;
    currentLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 19,
    }).addTo(map);

    // Update active button
    document.querySelectorAll('.tile-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tile === key);
    });
  }

  // Default: English tiles (CartoDB Voyager)
  setTileLayer('en');

  // Add tile switcher control
  const TileControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'tile-switcher leaflet-bar');
      div.innerHTML = Object.entries(TILE_LAYERS)
        .map(([key, cfg]) => `<button class="tile-btn${key === 'en' ? ' active' : ''}" data-tile="${key}" title="${cfg.label}">${cfg.label}</button>`)
        .join('');
      L.DomEvent.disableClickPropagation(div);
      div.addEventListener('click', e => {
        const btn = e.target.closest('.tile-btn');
        if (btn) setTileLayer(btn.dataset.tile);
      });
      return div;
    },
  });

  new TileControl().addTo(map);

  return map;
}
