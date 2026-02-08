import { store } from '../state/store.js';
import { getTransportIcon, TRANSPORT_TYPES, TRANSPORT_LABELS } from '../animation/transport-icons.js';
import { searchCity } from '../utils/geocode.js';
import { getSavedRoutes, saveNamedRoute, deleteSavedRoute } from '../utils/storage.js';

export function initSidebar() {
  const list = document.getElementById('waypoint-list');
  const empty = document.getElementById('sidebar-empty');

  // --- City search ---
  initSearch();

  function render() {
    const waypoints = store.getWaypoints();
    const segments = store.getSegments();

    if (waypoints.length === 0) {
      list.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    list.classList.remove('hidden');
    empty.classList.add('hidden');

    list.innerHTML = '';

    waypoints.forEach((wp, idx) => {
      const item = document.createElement('div');
      item.className = 'waypoint-item';
      item.dataset.id = wp.id;

      const row = document.createElement('div');
      row.className = 'waypoint-row';

      const num = document.createElement('div');
      num.className = 'waypoint-number';
      num.textContent = idx + 1;

      const input = document.createElement('input');
      input.className = 'waypoint-name-input';
      input.type = 'text';
      input.value = wp.name;
      input.placeholder = 'Название города...';
      input.addEventListener('change', () => {
        store.updateWaypointName(wp.id, input.value);
      });

      const del = document.createElement('button');
      del.className = 'waypoint-delete';
      del.innerHTML = '✕';
      del.title = 'Удалить точку';
      del.addEventListener('click', () => {
        store.removeWaypoint(wp.id);
      });

      row.appendChild(num);
      row.appendChild(input);
      row.appendChild(del);
      item.appendChild(row);
      list.appendChild(item);

      if (idx < waypoints.length - 1) {
        const seg = segments.find(s => s.from === wp.id);
        if (seg) {
          list.appendChild(buildSegmentConnector(seg));
        }
      }
    });
  }

  function buildSegmentConnector(seg) {
    const el = document.createElement('div');
    el.className = 'segment-connector';
    el.dataset.segId = seg.id;

    const line = document.createElement('div');
    line.className = 'segment-line';

    const selector = document.createElement('div');
    selector.className = 'transport-selector';

    TRANSPORT_TYPES.forEach(type => {
      const btn = document.createElement('button');
      btn.className = 'transport-btn' + (seg.transport === type ? ' active' : '');
      btn.dataset.transport = type;
      btn.title = TRANSPORT_LABELS[type];
      btn.textContent = getTransportIcon(type);
      btn.addEventListener('click', () => {
        store.setSegmentTransport(seg.id, type);
      });
      selector.appendChild(btn);
    });

    const label = document.createElement('span');
    label.className = 'segment-label';
    label.textContent = TRANSPORT_LABELS[seg.transport];

    el.appendChild(line);
    el.appendChild(selector);
    el.appendChild(label);
    return el;
  }

  store.subscribe('waypoint:added', render);
  store.subscribe('waypoint:removed', render);
  store.subscribe('waypoint:updated', render);
  store.subscribe('segment:added', render);
  store.subscribe('segment:recalculate', render);
  store.subscribe('cleared', render);

  render();

  // --- Saved routes ---
  initSavedRoutes();
}

function initSavedRoutes() {
  const panel = document.getElementById('saved-routes-panel');
  const btnSave = document.getElementById('btn-save-route');
  const btnShow = document.getElementById('btn-show-saved');

  function updateSaveBtn() {
    btnSave.disabled = store.getWaypoints().length < 2;
  }
  store.subscribe('waypoint:added', updateSaveBtn);
  store.subscribe('waypoint:removed', updateSaveBtn);
  store.subscribe('cleared', updateSaveBtn);
  updateSaveBtn();

  btnSave.addEventListener('click', () => {
    const name = prompt('Название маршрута:', defaultRouteName());
    if (!name) return;
    saveNamedRoute(name.trim(), store.getWaypoints(), store.getSegments());
    renderPanel();
    if (!panel.classList.contains('hidden')) return;
    panel.classList.remove('hidden');
  });

  btnShow.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) renderPanel();
  });

  function defaultRouteName() {
    const wps = store.getWaypoints();
    if (wps.length >= 2) return `${wps[0].name} → ${wps[wps.length - 1].name}`;
    return 'Маршрут';
  }

  function renderPanel() {
    const routes = getSavedRoutes();
    if (routes.length === 0) {
      panel.innerHTML = '<div class="saved-empty">Нет сохранённых маршрутов</div>';
      return;
    }
    panel.innerHTML = routes.map(r => `
      <div class="saved-route-item" data-id="${r.id}">
        <div class="saved-route-info">
          <span class="saved-route-name">${r.name}</span>
          <span class="saved-route-meta">${r.waypoints.length} точек · ${r.savedAt}</span>
        </div>
        <div class="saved-route-actions">
          <button class="saved-btn saved-load" data-id="${r.id}" title="Загрузить">▶</button>
          <button class="saved-btn saved-delete" data-id="${r.id}" title="Удалить">✕</button>
        </div>
      </div>
    `).join('');

    panel.querySelectorAll('.saved-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const route = getSavedRoutes().find(r => r.id === btn.dataset.id);
        if (!route) return;
        if (store.getWaypoints().length > 0 && !confirm(`Загрузить «${route.name}»? Текущий маршрут будет заменён.`)) return;
        store.loadRoute(route);
        panel.classList.add('hidden');
      });
    });

    panel.querySelectorAll('.saved-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteSavedRoute(btn.dataset.id);
        renderPanel();
      });
    });
  }
}

function initSearch() {
  // Build search UI and insert after sidebar-header
  const container = document.createElement('div');
  container.id = 'search-container';
  container.innerHTML = `
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input id="city-search" type="text" placeholder="Найти город и добавить точку..." autocomplete="off" spellcheck="false"/>
      <button id="search-clear" class="hidden" title="Очистить">✕</button>
    </div>
    <div id="search-results"></div>
  `;

  const header = document.getElementById('sidebar-header');
  header.insertAdjacentElement('afterend', container);

  const input = document.getElementById('city-search');
  const results = document.getElementById('search-results');
  const clearBtn = document.getElementById('search-clear');

  let debounceTimer = null;
  let lastQuery = '';

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearBtn.classList.toggle('hidden', !query);

    if (query === lastQuery) return;
    lastQuery = query;

    clearTimeout(debounceTimer);
    if (query.length < 2) {
      results.innerHTML = '';
      return;
    }

    results.innerHTML = '<div class="search-loading">Поиск...</div>';

    debounceTimer = setTimeout(async () => {
      const items = await searchCity(query);
      renderResults(items, query);
    }, 400);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    lastQuery = '';
    results.innerHTML = '';
    clearBtn.classList.add('hidden');
    input.focus();
  });

  // Close results when clicking outside
  document.addEventListener('click', e => {
    if (!container.contains(e.target)) {
      results.innerHTML = '';
    }
  });

  function renderResults(items, query) {
    if (items.length === 0) {
      results.innerHTML = `<div class="search-empty">Ничего не найдено по запросу «${query}»</div>`;
      return;
    }

    results.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'search-result-item';
      el.innerHTML = `
        <span class="search-result-name">${item.name}</span>
        <span class="search-result-country">${item.displayName !== item.name ? item.displayName.replace(item.name + ', ', '') : ''}</span>
      `;
      el.addEventListener('click', () => {
        store.addWaypoint(item.name, { lat: item.lat, lng: item.lng });
        input.value = '';
        lastQuery = '';
        results.innerHTML = '';
        clearBtn.classList.add('hidden');
      });
      results.appendChild(el);
    });
  }
}
