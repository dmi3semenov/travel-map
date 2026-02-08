const CURRENT_KEY = 'travel_map_current';
const SAVED_KEY = 'travel_map_saved';

function serialize(waypoints, segments) {
  return {
    waypoints: waypoints.map(({ id, name, latlng }) => ({ id, name, latlng })),
    segments: segments.map(({ id, from, to, transport }) => ({ id, from, to, transport })),
  };
}

export function saveCurrentRoute(waypoints, segments) {
  if (waypoints.length === 0) {
    localStorage.removeItem(CURRENT_KEY);
    return;
  }
  localStorage.setItem(CURRENT_KEY, JSON.stringify(serialize(waypoints, segments)));
}

export function loadCurrentRoute() {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getSavedRoutes() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNamedRoute(name, waypoints, segments) {
  const routes = getSavedRoutes();
  const route = {
    id: `route_${Date.now()}`,
    name,
    savedAt: new Date().toLocaleDateString('ru'),
    ...serialize(waypoints, segments),
  };
  routes.unshift(route);
  localStorage.setItem(SAVED_KEY, JSON.stringify(routes.slice(0, 20)));
  return route;
}

export function deleteSavedRoute(id) {
  const routes = getSavedRoutes().filter(r => r.id !== id);
  localStorage.setItem(SAVED_KEY, JSON.stringify(routes));
}
