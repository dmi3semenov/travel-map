import L from 'leaflet';
import { store } from '../state/store.js';
import { interpolateAlongPath, pathLength } from '../utils/geo.js';
import { createTransportMarkerIcon, updateTransportMarkerDOM } from './transport-icons.js';

const MIN_DURATION = 2000;  // ms
const MAX_DURATION = 12000; // ms
const KM_PER_SECOND = 400;

// Max zoom per transport type when fitting bounds
const MAX_ZOOM_BY_TRANSPORT = {
  plane: 5,
  train: 9,
  bus: 11,
  car: 11,
  walking: 14,
};

export class AnimationEngine {
  constructor(map) {
    this.map = map;
    this.animMarker = null;
    this.rafId = null;
    this.lastTimestamp = 0;
    this.segmentProgress = 0;
    this.currentSegIdx = 0;
    this._playing = false;
    this._lastFittedSegIdx = -1;
  }

  play() {
    if (store.getWaypoints().length < 2) return;
    const segments = store.getSegments();
    if (segments.length === 0) return;

    const wasIdle = store.getAnimationState() === 'idle';

    if (wasIdle) {
      this.currentSegIdx = 0;
      this.segmentProgress = 0;
      this._lastFittedSegIdx = -1;
    }

    this._playing = true;
    store.setAnimationState('playing');
    this.lastTimestamp = performance.now();

    if (!this.animMarker) {
      this._createMarker();
    } else {
      const seg = segments[this.currentSegIdx];
      if (seg) this._setMarkerTransport(seg.transport);
    }

    // Fit camera to current segment when starting fresh
    if (wasIdle) {
      this._fitToSegment(this.currentSegIdx);
    }

    this._tick(this.lastTimestamp);
  }

  pause() {
    this._playing = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    store.setAnimationState('paused');
  }

  reset() {
    this._playing = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.animMarker) {
      this.animMarker.remove();
      this.animMarker = null;
    }
    this.currentSegIdx = 0;
    this.segmentProgress = 0;
    this._lastFittedSegIdx = -1;
    store.setAnimationState('idle');
  }

  seek(progress) {
    const segments = store.getSegments();
    const total = segments.length;
    if (total === 0) return;

    const p = Math.max(0, Math.min(1, progress));
    let segIdx = Math.floor(p * total);
    let segProgress = p * total - segIdx;

    if (segIdx >= total) {
      segIdx = total - 1;
      segProgress = 1;
    }

    this.currentSegIdx = segIdx;
    this.segmentProgress = segProgress;
    this._lastFittedSegIdx = -1; // reset so _fitToSegment updates camera

    if (!this.animMarker) {
      this._createMarker();
    }

    const seg = segments[segIdx];
    if (seg) {
      this._setMarkerTransport(seg.transport);
      if (seg.pathPoints && seg.pathPoints.length >= 2) {
        this._updateMarkerPosition(seg);
      }
      this._fitToSegment(segIdx);
    }

    if (store.getAnimationState() === 'idle') {
      store.setAnimationState('paused');
    }

    this._updateProgress();
  }

  _createMarker() {
    const segments = store.getSegments();
    if (segments.length === 0) return;
    const seg = segments[this.currentSegIdx];
    if (!seg) return;

    const from = store.getWaypointById(seg.from);
    if (!from) return;

    const icon = createTransportMarkerIcon(seg.transport);
    this.animMarker = L.marker([from.latlng.lat, from.latlng.lng], {
      icon,
      zIndexOffset: 1000,
    }).addTo(this.map);
  }

  _tick(timestamp) {
    if (!this._playing) return;

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const segments = store.getSegments();
    const seg = segments[this.currentSegIdx];

    if (!seg || !seg.pathPoints || seg.pathPoints.length < 2) {
      this.currentSegIdx++;
      if (this.currentSegIdx >= segments.length) {
        this._finish();
        return;
      }
      this.segmentProgress = 0;
      this._updateMarkerTransport(segments[this.currentSegIdx]);
      this._fitToSegment(this.currentSegIdx);
      this.rafId = requestAnimationFrame(t => this._tick(t));
      return;
    }

    const duration = this._getSegmentDuration(seg);
    this.segmentProgress += delta / duration;

    // Pre-emptive zoom: start fitting next segment at 85% of current
    if (this.segmentProgress >= 0.85 && this.currentSegIdx + 1 < segments.length) {
      this._fitToSegment(this.currentSegIdx + 1);
    }

    if (this.segmentProgress >= 1) {
      this.segmentProgress = 0;
      this.currentSegIdx++;
      if (this.currentSegIdx >= segments.length) {
        this._placeAtEnd(seg);
        this._finish();
        return;
      }
      this._updateMarkerTransport(segments[this.currentSegIdx]);
      this._fitToSegment(this.currentSegIdx);
    }

    this._updateMarkerPosition(seg);
    this._updateProgress();

    this.rafId = requestAnimationFrame(t => this._tick(t));
  }

  _fitToSegment(segIdx) {
    if (segIdx === this._lastFittedSegIdx) return;
    this._lastFittedSegIdx = segIdx;

    const segments = store.getSegments();
    const seg = segments[segIdx];
    if (!seg) return;

    let latlngs;
    if (seg.pathPoints && seg.pathPoints.length >= 2) {
      latlngs = seg.pathPoints.map(p => [p.lat, p.lng]);
    } else {
      // pathPoints not loaded yet — use waypoint coords
      const from = store.getWaypointById(seg.from);
      const to = store.getWaypointById(seg.to);
      if (!from || !to) return;
      latlngs = [[from.latlng.lat, from.latlng.lng], [to.latlng.lat, to.latlng.lng]];
    }

    const bounds = L.latLngBounds(latlngs);
    const maxZoom = MAX_ZOOM_BY_TRANSPORT[seg.transport] || 8;

    this.map.flyToBounds(bounds, {
      padding: [80, 80],
      maxZoom,
      duration: 1.2,
    });
  }

  _getSegmentDuration(seg) {
    const dist = pathLength(seg.pathPoints);
    const raw = (dist / KM_PER_SECOND) * 1000;
    const base = Math.max(MIN_DURATION, Math.min(MAX_DURATION, raw));
    const speed = store.getSpeedForTransport(seg.transport);
    return base / speed;
  }

  _updateMarkerPosition(seg) {
    if (!this.animMarker || !seg.pathPoints) return;
    const result = interpolateAlongPath(seg.pathPoints, this.segmentProgress);
    if (!result) return;

    this.animMarker.setLatLng([result.pos.lat, result.pos.lng]);

    const el = this.animMarker.getElement();
    if (el) {
      const inner = el.querySelector('.transport-marker');
      if (inner) {
        inner.style.transform = `rotate(${result.bearing}deg)`;
      }
    }
  }

  _placeAtEnd(seg) {
    if (!this.animMarker || !seg.pathPoints || seg.pathPoints.length === 0) return;
    const last = seg.pathPoints[seg.pathPoints.length - 1];
    this.animMarker.setLatLng([last.lat, last.lng]);
  }

  _setMarkerTransport(type) {
    if (!this.animMarker) return;
    const el = this.animMarker.getElement();
    if (el) updateTransportMarkerDOM(el, type);
  }

  _updateMarkerTransport(seg) {
    this._setMarkerTransport(seg.transport);
  }

  _updateProgress() {
    const segments = store.getSegments();
    const total = segments.length;
    if (total === 0) return;
    const progress = (this.currentSegIdx + this.segmentProgress) / total;
    const pct = Math.round(progress * 100);
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    const bar = document.getElementById('progress-bar');
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${pct}%`;
    if (bar) bar.style.setProperty('--thumb-x', `${pct}%`);
  }

  _finish() {
    this._playing = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.animMarker) {
      this.animMarker.remove();
      this.animMarker = null;
    }
    this.currentSegIdx = 0;
    this.segmentProgress = 0;
    this._lastFittedSegIdx = -1;
    store.setAnimationState('idle');

    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    if (fill) fill.style.width = '0%';
    if (label) label.textContent = '0%';
  }
}
