class Store {
  constructor() {
    this._state = {
      waypoints: [],
      segments: [],
      animation: {
        state: 'idle', // 'idle' | 'playing' | 'paused'
        speed: 1,
        speedByTransport: {
          plane: 4,
          bus: 1,
          car: 1,
          train: 1,
          walking: 1,
        },
      },
    };
    this._listeners = {};
  }

  subscribe(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    };
  }

  emit(event, data) {
    const handlers = this._listeners[event] || [];
    handlers.forEach(fn => fn(data));
  }

  getWaypoints() {
    return this._state.waypoints;
  }

  getSegments() {
    return this._state.segments;
  }

  getAnimationState() {
    return this._state.animation.state;
  }

  getSpeed() {
    return this._state.animation.speed;
  }

  addWaypoint(name, latlng) {
    const id = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const wp = { id, name, latlng };
    this._state.waypoints.push(wp);

    // Auto-create segment to previous waypoint
    if (this._state.waypoints.length > 1) {
      const prev = this._state.waypoints[this._state.waypoints.length - 2];
      const segId = `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this._state.segments.push({
        id: segId,
        from: prev.id,
        to: id,
        transport: 'plane',
        pathPoints: [],
        polyline: null,
      });
      this.emit('segment:added', { segmentId: segId });
    }

    this.emit('waypoint:added', { waypointId: id });
    return id;
  }

  removeWaypoint(id) {
    const idx = this._state.waypoints.findIndex(w => w.id === id);
    if (idx === -1) return;

    // Remove connected segments
    const toRemove = this._state.segments.filter(s => s.from === id || s.to === id);
    toRemove.forEach(s => this.emit('segment:removing', { segmentId: s.id }));
    this._state.segments = this._state.segments.filter(s => s.from !== id && s.to !== id);

    // If removing middle point, reconnect neighbors
    if (idx > 0 && idx < this._state.waypoints.length - 1) {
      const prev = this._state.waypoints[idx - 1];
      const next = this._state.waypoints[idx + 1];
      const segId = `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this._state.segments.splice(idx - 1, 0, {
        id: segId,
        from: prev.id,
        to: next.id,
        transport: 'plane',
        pathPoints: [],
        polyline: null,
      });
      this.emit('segment:added', { segmentId: segId });
    }

    this._state.waypoints.splice(idx, 1);
    this.emit('waypoint:removed', { waypointId: id });
  }

  updateWaypointName(id, name) {
    const wp = this._state.waypoints.find(w => w.id === id);
    if (wp) {
      wp.name = name;
      this.emit('waypoint:updated', { waypointId: id });
    }
  }

  updateWaypointLatLng(id, latlng) {
    const wp = this._state.waypoints.find(w => w.id === id);
    if (wp) {
      wp.latlng = latlng;
      // Mark affected segments as needing recalculation
      const affected = this._state.segments.filter(s => s.from === id || s.to === id);
      affected.forEach(s => {
        s.pathPoints = [];
        this.emit('segment:recalculate', { segmentId: s.id });
      });
      this.emit('waypoint:updated', { waypointId: id });
    }
  }

  setSegmentTransport(segmentId, transport) {
    const seg = this._state.segments.find(s => s.id === segmentId);
    if (seg) {
      seg.transport = transport;
      seg.pathPoints = [];
      this.emit('segment:recalculate', { segmentId });
    }
  }

  setSegmentPathPoints(segmentId, points) {
    const seg = this._state.segments.find(s => s.id === segmentId);
    if (seg) {
      seg.pathPoints = points;
    }
  }

  setSegmentPolyline(segmentId, polyline) {
    const seg = this._state.segments.find(s => s.id === segmentId);
    if (seg) {
      seg.polyline = polyline;
    }
  }

  getWaypointById(id) {
    return this._state.waypoints.find(w => w.id === id);
  }

  getSegmentById(id) {
    return this._state.segments.find(s => s.id === id);
  }

  setAnimationState(state) {
    this._state.animation.state = state;
    this.emit('animation:stateChange', { state });
  }

  setSpeed(speed) {
    this._state.animation.speed = speed;
  }

  getSpeedForTransport(type) {
    return this._state.animation.speedByTransport[type] ?? this._state.animation.speed;
  }

  setSpeedForTransport(type, speed) {
    this._state.animation.speedByTransport[type] = speed;
    this.emit('animation:speedChange', { type, speed });
  }

  clearAll() {
    // Remove all segments first
    this._state.segments.forEach(s => this.emit('segment:removing', { segmentId: s.id }));
    this._state.segments = [];
    // Remove all waypoints
    const ids = this._state.waypoints.map(w => w.id);
    this._state.waypoints = [];
    ids.forEach(id => this.emit('waypoint:removed', { waypointId: id }));
    this.emit('cleared');
  }
}

export const store = new Store();
