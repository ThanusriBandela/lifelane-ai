/* ═══════════════════════════════════════════════════════
   SwiftRoute — app.js
   Multi-page Emergency Routing Application
   Features:
   - Uber-style location autocomplete (Nominatim API)
   - Real road routing via OSRM (3 alternatives)
   - Normal mode: Low/Medium/High congestion paths
   - Emergency mode: priority route + signal override
   - Traffic signal simulation with green override
   - Nearby vehicle broadcast alerts
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────────
   STATE
   ──────────────────────────────────────────── */
const STATE = {
  mode: 'normal',           // 'normal' | 'emergency'
  emgType: 'ambulance',
  src: null,                // { lat, lng, name }
  dst: null,                // { lat, lng, name }
  routeLayers: [],
  signalMarkers: [],
  trackInterval: null,
  searchTimers: { src: null, dst: null },
  activeSignals: []
};

/* ────────────────────────────────────────────
   PAGE NAVIGATION
   ──────────────────────────────────────────── */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goToHome()   { showPage('page-home'); }
function goToSelect() { showPage('page-select'); }

function goToMap(mode) {
  STATE.mode = mode;
  showPage('page-map');
  initMapPage(mode);
}

/* ────────────────────────────────────────────
   MAP INITIALIZATION
   ──────────────────────────────────────────── */
let map = null;

function initMapPage(mode) {
  // Mode badge
  const badge = document.getElementById('mode-badge');
  badge.textContent  = mode === 'emergency' ? 'EMERGENCY' : 'NORMAL';
  badge.className    = `mode-badge ${mode}`;

  // Route button style
  const btn = document.getElementById('route-btn');
  btn.className = `route-btn ${mode === 'emergency' ? 'emg-mode' : 'normal-mode'}`;
  document.getElementById('route-btn-text').textContent =
    mode === 'emergency' ? '🚨 DISPATCH EMERGENCY ROUTE' : '🗺️ FIND ROUTES';

  // Show/hide emergency-only panels
  document.getElementById('emg-type-panel').style.display  = mode === 'emergency' ? 'block' : 'none';
  document.getElementById('alert-msg-panel').style.display = mode === 'emergency' ? 'block' : 'none';

  // Init map once
  if (!map) {
    map = L.map('map', { center: [17.45, 78.36], zoom: 13, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Click map → set source/dest
    map.on('click', e => {
      const active = document.activeElement;
      if (active && active.classList.contains('loc-input')) {
        const which = active.id === 'src-input' ? 'src' : 'dst';
        reverseGeocode(e.latlng.lat, e.latlng.lng, which);
      }
    });
  }

  addLog('SYSTEM', 'info', 'SwiftRoute initialized. Type a location to search.');
  startClock();
}

/* ────────────────────────────────────────────
   CLOCK
   ──────────────────────────────────────────── */
let clockInterval = null;
function startClock() {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    const el = document.getElementById('clock-map');
    if (el) el.textContent = t;
  }, 1000);
}

/* ────────────────────────────────────────────
   EMERGENCY VEHICLE TYPE
   ──────────────────────────────────────────── */
function selectEmgType(el, type) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  STATE.emgType = type;
}

/* ════════════════════════════════════════════
   LOCATION AUTOCOMPLETE  (Nominatim API)
   Uber/Rapido-style — type to search places
   ════════════════════════════════════════════ */
function onLocationInput(which) {
  const inputEl = document.getElementById(`${which}-input`);
  const query   = inputEl.value.trim();
  const listEl  = document.getElementById(`${which}-autocomplete`);

  // Clear previous search timer (debounce 350ms)
  clearTimeout(STATE.searchTimers[which]);

  if (query.length < 2) {
    listEl.innerHTML = '';
    listEl.classList.remove('visible');
    return;
  }

  // Show loading
  listEl.innerHTML = `<div class="ac-loading"><span class="spinner"></span>Searching…</div>`;
  listEl.classList.add('visible');

  STATE.searchTimers[which] = setTimeout(async () => {
    try {
      const results = await searchPlaces(query);
      renderAutocomplete(which, results);
    } catch (e) {
      listEl.innerHTML = `<div class="ac-loading" style="color:#ff6b6b">Search failed. Check internet.</div>`;
    }
  }, 350);
}

async function searchPlaces(query) {
  // Nominatim free geocoding — same engine used by OpenStreetMap
  const url = `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'SwiftRouteApp/1.0' }
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

function renderAutocomplete(which, results) {
  const listEl = document.getElementById(`${which}-autocomplete`);
  if (!results || results.length === 0) {
    listEl.innerHTML = `<div class="ac-loading">No results found. Try a different search.</div>`;
    return;
  }

  listEl.innerHTML = results.map((r, i) => {
    const name    = r.name || r.display_name.split(',')[0];
    const address = r.display_name;
    const pin     = getPlacePin(r.type, r.class);
    return `<div class="ac-item" onclick="selectLocation('${which}', ${r.lat}, ${r.lon}, ${JSON.stringify(r.display_name).replace(/'/g,"&#39;")}, ${i})">
      <span class="ac-pin">${pin}</span>
      <div class="ac-text">
        <span class="ac-name">${name}</span>
        <span class="ac-addr">${address.substring(0, 60)}${address.length > 60 ? '…' : ''}</span>
      </div>
    </div>`;
  }).join('');
}

function getPlacePin(type, cls) {
  if (cls === 'amenity') {
    if (type === 'hospital' || type === 'clinic') return '🏥';
    if (type === 'school' || type === 'university') return '🏫';
    if (type === 'restaurant' || type === 'cafe') return '🍽️';
    if (type === 'fuel') return '⛽';
    return '📍';
  }
  if (cls === 'highway') return '🛣️';
  if (cls === 'railway') return '🚉';
  if (cls === 'place') return '📍';
  return '📍';
}

function selectLocation(which, lat, lng, displayName, idx) {
  STATE[which] = { lat: parseFloat(lat), lng: parseFloat(lng), name: displayName };
  const shortName = displayName.split(',').slice(0, 2).join(',');
  document.getElementById(`${which}-input`).value = shortName;

  // Close autocomplete
  const listEl = document.getElementById(`${which}-autocomplete`);
  listEl.innerHTML = '';
  listEl.classList.remove('visible');

  // Place a temporary marker
  placePickupMarker(which, parseFloat(lat), parseFloat(lng), shortName);

  addLog('MAP', 'info', `${which === 'src' ? 'Source' : 'Destination'} set: ${shortName}`);

  // Fly map to location
  map.flyTo([parseFloat(lat), parseFloat(lng)], 14, { duration: 1.2 });
}

/* ────────────────────────────────────────────
   REVERSE GEOCODE (click on map)
   ──────────────────────────────────────────── */
async function reverseGeocode(lat, lng, which) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SwiftRouteApp/1.0' } });
    const data = await res.json();
    const name = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    selectLocation(which, lat, lng, name, 0);
  } catch {
    selectLocation(which, lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`, 0);
  }
}

/* ────────────────────────────────────────────
   USE MY LOCATION (GPS)
   ──────────────────────────────────────────── */
function useMyLocation(which) {
  if (!navigator.geolocation) { showToast('Geolocation not supported.', 'warning'); return; }
  document.getElementById(`${which}-input`).value = 'Getting location…';
  navigator.geolocation.getCurrentPosition(
    pos => reverseGeocode(pos.coords.latitude, pos.coords.longitude, which),
    ()  => {
      showToast('Could not get location. Please allow GPS access.', 'warning');
      document.getElementById(`${which}-input`).value = '';
    }
  );
}

/* ════════════════════════════════════════════
   PICKUP / DROP MARKERS
   ════════════════════════════════════════════ */
const pinMarkers = { src: null, dst: null };

function placePickupMarker(which, lat, lng, name) {
  if (pinMarkers[which]) map.removeLayer(pinMarkers[which]);

  const isSrc = which === 'src';
  const icon = L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="width:20px;height:20px;border-radius:50%;border:3px solid ${isSrc ? '#00e05a' : '#ff2525'};
        background:${isSrc ? '#00e05a' : '#ff2525'};display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 12px ${isSrc ? 'rgba(0,224,90,.8)' : 'rgba(255,37,37,.8)'};font-size:8px;color:#000;font-weight:bold;">
        ${isSrc ? '▲' : '▼'}
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:8px;
        color:${isSrc ? '#00e05a' : '#ff2525'};white-space:nowrap;
        text-shadow:0 0 6px rgba(0,0,0,.9);background:rgba(0,0,0,.6);
        padding:1px 4px;border-radius:3px;">
        ${isSrc ? 'PICKUP' : 'DROP-OFF'}
      </div>
    </div>`,
    iconSize: [60, 38], iconAnchor: [10, 10]
  });

  pinMarkers[which] = L.marker([lat, lng], { icon })
    .addTo(map)
    .bindPopup(`<div class="pop-t" style="color:${isSrc ? '#00e05a' : '#ff2525'}">${isSrc ? '▲ PICKUP' : '▼ DROP-OFF'}</div>
      <div class="pop-r"><span class="pop-k">LOCATION:</span>${name.substring(0, 50)}</div>
      <div class="pop-r"><span class="pop-k">COORDS:</span>${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`);
}

/* ════════════════════════════════════════════
   VEHICLE MARKERS (nearby vehicles)
   ════════════════════════════════════════════ */
const VEHICLE_EMOJIS = { ambulance:'🚑', firetruck:'🚒', police:'🚓', hazmat:'☣️', car:'🚗', bus:'🚌', truck:'🚛' };

function mkVehicleIcon(type, label) {
  const isEmg = ['ambulance','firetruck','police','hazmat'].includes(type);
  const color = isEmg ? '#ff2525' : '#00e05a';
  const emoji = VEHICLE_EMOJIS[type] || '🚗';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="width:32px;height:32px;border-radius:50%;background:${color};
        border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:14px;
        box-shadow:0 0 12px ${color}99;cursor:pointer;">${emoji}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:7px;color:${color};
        white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.9);background:rgba(0,0,0,.5);
        padding:1px 4px;border-radius:2px;">${label}</div>
    </div>`,
    iconSize: [32, 46], iconAnchor: [16, 16], popupAnchor: [0, -18]
  });
}

/* ════════════════════════════════════════════
   OSRM ROUTING ENGINE
   Returns up to 3 real road alternatives
   ════════════════════════════════════════════ */
async function fetchOSRM(src, dst) {
  const url = `https://router.project-osrm.org/route/v1/driving/` +
    `${src.lng},${src.lat};${dst.lng},${dst.lat}` +
    `?alternatives=3&geometries=geojson&overview=full&steps=false`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 'Ok') throw new Error(json.message || 'OSRM error');
  return json.routes;
}

function toLatLng(route) {
  return route.geometry.coordinates.map(c => [c[1], c[0]]);
}

function fmtDist(m) {
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m} min`;
}
function haversine(la1,lo1,la2,lo2) {
  const R=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/* ════════════════════════════════════════════
   CLEAR ROUTES
   ════════════════════════════════════════════ */
function clearRoutes() {
  STATE.routeLayers.forEach(l => map.removeLayer(l));
  STATE.routeLayers = [];
  STATE.signalMarkers.forEach(m => map.removeLayer(m));
  STATE.signalMarkers = [];
  if (STATE.trackInterval) { clearInterval(STATE.trackInterval); STATE.trackInterval = null; }
  document.getElementById('route-results').style.display = 'none';
  document.getElementById('signal-panel').style.display  = 'none';
  addLog('ROUTE','info','Map cleared.');
}

/* ════════════════════════════════════════════
   MAIN: CALCULATE ROUTE
   ════════════════════════════════════════════ */
async function calculateRoute() {
  if (!STATE.src || !STATE.dst) {
    showToast('Please set both pickup and destination.', 'warning');
    return;
  }

  clearRoutes();
  setRouteLoading(true);
  addLog('OSRM','info',`Fetching real road routes: "${STATE.src.name.split(',')[0]}" → "${STATE.dst.name.split(',')[0]}"`);

  try {
    const routes = await fetchOSRM(STATE.src, STATE.dst);
    setRouteLoading(false);

    if (!routes || routes.length === 0) {
      showToast('No routes found between these locations.', 'warning');
      return;
    }

    if (STATE.mode === 'normal') {
      renderNormalRoutes(routes);
    } else {
      renderEmergencyRoute(routes);
    }

  } catch (err) {
    setRouteLoading(false);
    addLog('ERROR','warning','Routing failed: ' + err.message + '. Check internet.');
    showToast('Route fetch failed — check connection', 'warning');
  }
}

/* ════════════════════════════════════════════
   NORMAL MODE — 3 routes:
   Green  = Low traffic (fastest OSRM route)
   Orange = Medium traffic (2nd alternative)
   Red    = High congestion (3rd or slowest)
   ════════════════════════════════════════════ */
function renderNormalRoutes(routes) {
  // We always have at least 1 route; pad to 3 for display
  const TRAFFIC = [
    { key:'low',    label:'LOW TRAFFIC',    color:'#00e05a', weight:6, dash:null,   badge:'FASTEST',    cls:'low'    },
    { key:'medium', label:'MEDIUM TRAFFIC', color:'#ff8c00', weight:5, dash:'8,5',  badge:'ALTERNATE',  cls:'medium' },
    { key:'high',   label:'HIGH CONGESTION',color:'#ff2525', weight:4, dash:'5,8',  badge:'CONGESTED',  cls:'high'   },
  ];

  const toDraw = routes.slice(0, 3);

  toDraw.forEach((route, i) => {
    const T   = TRAFFIC[i] || TRAFFIC[2];
    const pts = toLatLng(route);

    // Glow layer
    const glow = L.polyline(pts, { color: T.color + '22', weight: 16, opacity: 1 }).addTo(map);
    STATE.routeLayers.push(glow);

    // Main polyline
    const poly = L.polyline(pts, {
      color: T.color, weight: T.weight, opacity: i === 0 ? 0.95 : 0.75,
      dashArray: T.dash, lineCap: 'round', lineJoin: 'round'
    }).addTo(map);
    STATE.routeLayers.push(poly);

    // Click popup
    poly.bindPopup(`<div class="pop-t" style="color:${T.color}">${T.label}</div>
      <div class="pop-r"><span class="pop-k">DISTANCE</span>${fmtDist(route.distance)}</div>
      <div class="pop-r"><span class="pop-k">ETA</span>${fmtTime(route.duration)}</div>
      <div class="pop-r"><span class="pop-k">VIA</span>Real road (OSRM)</div>`);
  });

  // Fit map
  const allPts = toDraw.flatMap(r => toLatLng(r));
  map.fitBounds(L.latLngBounds(allPts), { padding: [40, 40], maxZoom: 15 });

  // Ensure source/dest markers are on top
  ['src','dst'].forEach(w => { if (pinMarkers[w]) pinMarkers[w].addTo(map); });

  // Build route cards
  buildNormalCards(routes, TRAFFIC);

  // Log
  const fastest = routes[0];
  addLog('ROUTE','success',
    `${toDraw.length} real road routes found. Fastest: ${fmtDist(fastest.distance)}, ETA ${fmtTime(fastest.duration)}.`);
  showToast(`${toDraw.length} routes found — fastest is ${fmtTime(fastest.duration)}`, 'success');
setTimeout(() => {
  map.invalidateSize();
}, 200);
}

function buildNormalCards(routes, TRAFFIC) {
  const panel = document.getElementById('route-results');
  const cards = document.getElementById('route-cards');
  panel.style.display = 'block';
  cards.innerHTML = '';

  routes.slice(0, 3).forEach((route, i) => {
    const T    = TRAFFIC[i] || TRAFFIC[2];
    const card = document.createElement('div');
    card.className = `r-card ${T.cls}`;
    card.style.animationDelay = `${i * 0.08}s`;
    card.innerHTML = `
      <div class="r-card-header">
        <span class="r-card-tag ${T.cls}">${T.label}</span>
        <span class="r-card-badge ${i===0?'badge-fastest':i===1?'badge-alt':'badge-busy'}">
          ${i===0?'FASTEST':i===1?'ALT':'BUSY'}
        </span>
      </div>
      <div class="r-card-stats">
        <div class="r-stat">
          <span class="r-stat-val">${fmtDist(route.distance)}</span>
          <span class="r-stat-key">DISTANCE</span>
        </div>
        <div class="r-stat">
          <span class="r-stat-val">${fmtTime(route.duration)}</span>
          <span class="r-stat-key">ETA</span>
        </div>
      </div>
      <div class="r-card-note">
        ${i===0 ? '✓ Least congested — recommended' : i===1 ? '⚡ Alternate road' : '⚠ Heavy traffic expected'}
      </div>`;
    cards.appendChild(card);
  });
}

/* ════════════════════════════════════════════
   EMERGENCY MODE
   - Fastest real road route (bright red)
   - Traffic signal override simulation
   - Nearby vehicle broadcast alerts
   - Live vehicle animation along route
   ════════════════════════════════════════════ */
function renderEmergencyRoute(routes) {
  const fastest = routes[0];
  const pts     = toLatLng(fastest);

  // Glow halo
  const halo = L.polyline(pts, { color: 'rgba(255,37,37,.12)', weight: 22, opacity: 1 }).addTo(map);
  STATE.routeLayers.push(halo);

  // Main emergency route (red)
  const poly = L.polyline(pts, {
    color: '#ff2525', weight: 7, opacity: 0.95, lineCap: 'round', lineJoin: 'round'
  }).addTo(map);
  STATE.routeLayers.push(poly);

  // Animated pulse on top
  const pulse = L.polyline(pts, {
    color: 'rgba(255,200,200,.3)', weight: 3, dashArray: '4,12', opacity: 1
  }).addTo(map);
  STATE.routeLayers.push(pulse);

  poly.bindPopup(`<div class="pop-t" style="color:#ff2525">🚨 EMERGENCY ROUTE</div>
    <div class="pop-r"><span class="pop-k">DISTANCE</span>${fmtDist(fastest.distance)}</div>
    <div class="pop-r"><span class="pop-k">ETA (EMG)</span>${fmtTime(Math.round(fastest.duration * 0.6))}</div>
    <div class="pop-r"><span class="pop-k">VEHICLE</span>${STATE.emgType.toUpperCase()}</div>`);

  // Fit map
  map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 14 });

  // Source/dest markers on top
  ['src','dst'].forEach(w => { if (pinMarkers[w]) pinMarkers[w].addTo(map); });

  // Build emergency route card
  buildEmgCard(fastest);

  // Simulate traffic signals along route
  simulateTrafficSignals(pts);

  // Spawn nearby vehicles and send alerts
  spawnNearbyVehicles();
  broadcastAlerts();

  // Flash screen
  const flash = document.createElement('div');
  flash.className = 'flash-overlay';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 700);

  // Animate emergency vehicle along route
  animateEmgVehicle(pts);

  addLog('DISPATCH','critical',
    `🚨 ${STATE.emgType.toUpperCase()} dispatched! Route: ${fmtDist(fastest.distance)}, ETA: ${fmtTime(Math.round(fastest.duration*0.6))} (emergency speed). Traffic signals overridden.`);
  showToast(`Emergency route active — ${fmtTime(Math.round(fastest.duration*0.6))} ETA`, 'critical');
setTimeout(() => {
  map.invalidateSize();
}, 200);
}

function buildEmgCard(route) {
  const panel = document.getElementById('route-results');
  const cards = document.getElementById('route-cards');
  panel.style.display = 'block';
  cards.innerHTML = `
    <div class="r-card emg">
      <div class="r-card-header">
        <span class="r-card-tag emg">🚨 EMERGENCY ROUTE</span>
        <span class="r-card-badge badge-fastest">PRIORITY</span>
      </div>
      <div class="r-card-stats">
        <div class="r-stat">
          <span class="r-stat-val">${fmtDist(route.distance)}</span>
          <span class="r-stat-key">DISTANCE</span>
        </div>
        <div class="r-stat">
          <span class="r-stat-val" style="color:var(--red)">${fmtTime(Math.round(route.duration * 0.6))}</span>
          <span class="r-stat-key">EMG ETA</span>
        </div>
        <div class="r-stat">
          <span class="r-stat-val">${fmtTime(route.duration)}</span>
          <span class="r-stat-key">NORMAL ETA</span>
        </div>
      </div>
      <div class="r-card-note" style="color:var(--red)">⚡ 40% faster — lights + road clearance</div>
    </div>`;
}

/* ════════════════════════════════════════════
   TRAFFIC SIGNAL SIMULATION
   Places signal markers along the route.
   When emergency vehicle is nearby:
     - Emergency path signal → turns GREEN
     - Cross signals → turn RED
   ════════════════════════════════════════════ */
function simulateTrafficSignals(routePts) {
  // Place signals every ~10 points along route
  const signalInterval = Math.max(3, Math.floor(routePts.length / 6));
  const signals = [];

  for (let i = signalInterval; i < routePts.length - signalInterval; i += signalInterval) {
    const [lat, lng] = routePts[i];
    // Slightly offset so signal doesn't overlap exact road
    const slat = lat + (Math.random() - 0.5) * 0.0005;
    const slng = lng + (Math.random() - 0.5) * 0.0005;

    const signal = {
      id: `SIG-${signals.length + 1}`,
      lat: slat, lng: slng,
      routeIdx: i,
      state: 'red',   // 'red' | 'green' | 'override'
      marker: null
    };

    signal.marker = createSignalMarker(signal, 'red');
    signals.push(signal);
    STATE.signalMarkers.push(signal.marker);
    STATE.activeSignals.push(signal);
  }

  // Show signal panel
  renderSignalPanel(signals);

  return signals;
}

function createSignalMarker(signal, state) {
  const icon = L.divIcon({
    className: '',
    html: `<div id="tl-${signal.id}" class="tl-marker">
      <div class="tl-dot ${state === 'red'    ? 'on-red'   : ''}" id="${signal.id}-r"></div>
      <div class="tl-dot ${state === 'yellow' ? 'on-yellow': ''}" id="${signal.id}-y"></div>
      <div class="tl-dot ${state === 'green'  ? 'on-green' : ''}" id="${signal.id}-g"></div>
    </div>`,
    iconSize: [24, 46], iconAnchor: [12, 46]
  });
  return L.marker([signal.lat, signal.lng], { icon })
    .addTo(map)
    .bindPopup(`<div class="pop-t" style="color:var(--yellow)">🚦 ${signal.id}</div>
      <div class="pop-r"><span class="pop-k">STATUS</span><span id="popup-${signal.id}">RED</span></div>
      <div class="pop-r"><span class="pop-k">OVERRIDE</span>EMERGENCY ACTIVE</div>`);
}

function setSignalState(signalId, state) {
  // Update DOM light elements
  const r = document.getElementById(`${signalId}-r`);
  const y = document.getElementById(`${signalId}-y`);
  const g = document.getElementById(`${signalId}-g`);
  if (r) r.className = `tl-dot ${state === 'red'    ? 'on-red'    : ''}`;
  if (y) y.className = `tl-dot ${state === 'yellow' ? 'on-yellow' : ''}`;
  if (g) g.className = `tl-dot ${state === 'green'  ? 'on-green'  : ''}`;

  // Update panel status
  const panelStatus = document.getElementById(`ps-${signalId}`);
  if (panelStatus) {
    panelStatus.textContent = state === 'green' ? '🟢 OVERRIDE — GREEN' : '🔴 RED';
    panelStatus.className   = `signal-status ${state === 'green' ? 'override' : 'normal'}`;
  }
}

function renderSignalPanel(signals) {
  const panel = document.getElementById('signal-panel');
  const list  = document.getElementById('signal-list');
  panel.style.display = 'block';
  list.innerHTML = signals.map((s, i) => `
    <div class="signal-item" style="animation-delay:${i*0.06}s">
      <div class="signal-lights">
        <div class="sig-light on-red"   id="p-${s.id}-r"></div>
        <div class="sig-light"          id="p-${s.id}-y"></div>
        <div class="sig-light"          id="p-${s.id}-g"></div>
      </div>
      <span class="signal-name">${s.id}</span>
      <span class="signal-status normal" id="ps-${s.id}">🔴 RED</span>
    </div>`).join('');
}

/* ════════════════════════════════════════════
   NEARBY VEHICLES — spawn around source
   ════════════════════════════════════════════ */
const nearbyVehicleMarkers = [];

function spawnNearbyVehicles() {
  // Remove old
  nearbyVehicleMarkers.forEach(m => map.removeLayer(m));
  nearbyVehicleMarkers.length = 0;

  const { lat, lng } = STATE.src;
  const types = ['car','car','bus','car','truck','car'];

  types.forEach((type, i) => {
    const angle  = (i / types.length) * Math.PI * 2;
    const radius = 0.005 + Math.random() * 0.015;
    const vlat   = lat + Math.cos(angle) * radius;
    const vlng   = lng + Math.sin(angle) * radius;
    const id     = `${type.toUpperCase()}-${100 + i}`;

    const m = L.marker([vlat, vlng], { icon: mkVehicleIcon(type, id) })
      .addTo(map)
      .bindPopup(`<div class="pop-t" style="color:var(--green)">${id}</div>
        <div class="pop-r"><span class="pop-k">TYPE</span>${type.toUpperCase()}</div>
        <div class="pop-r"><span class="pop-k">STATUS</span>⚠ ALERT RECEIVED</div>`);
    nearbyVehicleMarkers.push(m);
    STATE.routeLayers.push(m);
  });
}

/* ════════════════════════════════════════════
   BROADCAST EMERGENCY ALERTS
   ════════════════════════════════════════════ */
function broadcastAlerts() {
  const msg    = document.getElementById('alert-msg')?.value || 'Emergency vehicle approaching — clear the road.';
  const type   = STATE.emgType;
  const srcName = STATE.src.name.split(',')[0];

  const vehicles = ['CAR-100','CAR-101','BUS-102','CAR-103','TRUCK-104','CAR-105'];

  vehicles.forEach((vid, i) => {
    setTimeout(() => {
      addLog('BROADCAST','critical',
        `📡 ALERT → ${vid}: ${msg}`);
    }, i * 400);
  });

  setTimeout(() => {
    addLog('SIGNAL','warning',
      `🚦 Traffic signal override activated. Emergency corridor cleared along route.`);
  }, 800);

  setTimeout(() => {
    addLog('DISPATCH','success',
      `✅ All ${vehicles.length} nearby vehicles notified. Route corridor is being cleared.`);
    showToast(`${vehicles.length} vehicles alerted — road clearing`, 'critical');
  }, vehicles.length * 400 + 200);
}

/* ════════════════════════════════════════════
   ANIMATE EMERGENCY VEHICLE ALONG ROUTE
   + Override traffic signals as it approaches
   ════════════════════════════════════════════ */
function animateEmgVehicle(routePts) {
  if (STATE.trackInterval) clearInterval(STATE.trackInterval);

  const EMOJIS   = { ambulance:'🚑', firetruck:'🚒', police:'🚓', hazmat:'☣️' };
  const emoji    = EMOJIS[STATE.emgType] || '🚑';
  const step     = Math.max(1, Math.floor(routePts.length / 50));
  let   idx      = 0;
  let   sigIdx   = 0;

  // Create moving marker
  const movIcon = L.divIcon({
    className: '',
    html: `<div style="font-size:26px;filter:drop-shadow(0 0 12px rgba(255,37,37,.9));
      animation:none;">${emoji}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16]
  });
  const movMarker = L.marker(routePts[0], { icon: movIcon, zIndexOffset: 1000 }).addTo(map);
  STATE.routeLayers.push(movMarker);

  STATE.trackInterval = setInterval(() => {
    if (idx >= routePts.length) {
      clearInterval(STATE.trackInterval);
      addLog('DISPATCH','success',`🏁 ${STATE.emgType.toUpperCase()} reached destination.`);
      showToast('Emergency vehicle reached destination!', 'success');
      // Reset all signals
      STATE.activeSignals.forEach(s => setSignalState(s.id, 'red'));
      return;
    }

    movMarker.setLatLng(routePts[idx]);

    // Check proximity to each signal → override if within ~300m
    STATE.activeSignals.forEach(sig => {
      const [slat, slng] = routePts[idx];
      const dist = haversine(slat, slng, sig.lat, sig.lng);

      if (dist < 0.3 && sig.state !== 'green') {
        // Vehicle approaching → turn GREEN on emergency path, RED on cross
        sig.state = 'green';
        setSignalState(sig.id, 'green');
        addLog('SIGNAL','warning',
          `🚦 ${sig.id}: OVERRIDDEN → GREEN (emergency corridor). Cross traffic → RED.`);

      } else if (dist > 0.5 && sig.state === 'green') {
        // Vehicle passed → restore normal
        sig.state = 'red';
        setSignalState(sig.id, 'red');
        addLog('SIGNAL','info', `🚦 ${sig.id}: Restored to normal operation.`);
      }
    });

    idx += step;
  }, 800);
}

/* ════════════════════════════════════════════
   LOADING STATE
   ════════════════════════════════════════════ */
function setRouteLoading(on) {
  const btn  = document.getElementById('route-btn');
  const text = document.getElementById('route-btn-text');
  btn.disabled = on;
  if (on) {
    text.innerHTML = `<span class="spinner"></span>FINDING ROUTES…`;
  } else {
    text.textContent = STATE.mode === 'emergency'
      ? '🚨 DISPATCH EMERGENCY ROUTE'
      : '🗺️ FIND ROUTES';
  }
}

/* ════════════════════════════════════════════
   ALERT LOG
   ════════════════════════════════════════════ */
function addLog(type, cls, msg) {
  const log  = document.getElementById('alert-log');
  if (!log) return;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const COLORS = { critical:'var(--red)', warning:'var(--orange)', info:'var(--blue)', success:'var(--green)' };
  const el = document.createElement('div');
  el.className = `log-item ${cls}`;
  el.innerHTML = `<div class="log-hdr">
    <span class="log-type" style="color:${COLORS[cls]||COLORS.info}">${type}</span>
    <span class="log-time">${time}</span>
  </div>
  <div class="log-msg">${msg}</div>`;
  log.insertBefore(el, log.firstChild);
  while (log.children.length > 50) log.removeChild(log.lastChild);
}

/* ════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ════════════════════════════════════════════ */
function showToast(msg, cls) {
  const el = document.createElement('div');
  el.className = `toast ${cls}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ════════════════════════════════════════════
   CLOSE AUTOCOMPLETE on outside click
   ════════════════════════════════════════════ */
document.addEventListener('click', e => {
  ['src','dst'].forEach(w => {
    const list = document.getElementById(`${w}-autocomplete`);
    const inp  = document.getElementById(`${w}-input`);
    if (list && inp && !list.contains(e.target) && e.target !== inp) {
      list.innerHTML = '';
      list.classList.remove('visible');
    }
  });
});

/* ════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════ */
window.addEventListener('load', () => {
  showPage('page-home');
});
/* -- AUTH SYSTEM ---------------------------------------------- */
function getCurrentUser() { try { return JSON.parse(localStorage.getItem('ll_current_user')||'null'); } catch(e){ return null; } }
function getUsers() { try { return JSON.parse(localStorage.getItem('ll_users')||'[]'); } catch(e){ return []; } }
function setCurrentUser(u) { localStorage.setItem('ll_current_user', JSON.stringify(u)); }

function enterApp() {
  var user = getCurrentUser();
  if (!user) { showPage('page-auth'); return; }
  var g = document.getElementById('home-user-greeting');
  if (g) g.textContent = 'Welcome, ' + user.name.split(' ')[0] + ' ??';
  showPage('page-home');
}
function doLogout() { localStorage.removeItem('ll_current_user'); disconnectWS(); stopVoiceAlert(); showPage('page-auth'); }
function goToHome() { if(!getCurrentUser()){showPage('page-auth');return;} showPage('page-home'); disconnectWS(); stopVoiceAlert(); }
function goToSelect() { showPage('page-select'); disconnectWS(); stopVoiceAlert(); }
function goToHistory() { showPage('page-history'); loadDispatchHistory(); }
function goToMap(mode) { S.mode=mode; showPage('page-map'); initMapPage(mode); }
function toggleMobileMapView() {
  var body = document.getElementById('map-body');
  var btn = document.getElementById('map-toggle-btn');
  if (!body) return;
  var isMapView = body.classList.toggle('map-view-active');
  if (btn) btn.textContent = isMapView ? '?' : '???';
  if (map) setTimeout(function(){ map.invalidateSize(); }, 50);
}
function signupStep1Next() {
  var name=document.getElementById('signup-name').value.trim();
  var email=document.getElementById('signup-email').value.trim();
  var pass=document.getElementById('signup-password').value;
  var err=document.getElementById('signup-error1');
  err.style.display='none';
  if(!name){err.textContent='Please enter your full name.';err.style.display='block';return;}
  if(!email||!email.includes('@')){err.textContent='Please enter a valid email.';err.style.display='block';return;}
  if(pass.length<6){err.textContent='Password must be at least 6 characters.';err.style.display='block';return;}
  var users=getUsers();
  if(users.find(function(u){return u.email===email;})){err.textContent='Account already exists. Please login.';err.style.display='block';return;}
  var wrap=document.getElementById('signup-contacts-fields');
  wrap.innerHTML='';
  for(var i=1;i<=5;i++){var row=document.createElement('div');row.className='contact-field-row';row.innerHTML='<div class="contact-num-badge">'+i+'</div><input type="tel" id="contact-'+i+'" class="auth-input" placeholder="Contact '+i+' phone number"/>';wrap.appendChild(row);}
  document.getElementById('signup-step1').style.display='none';
  document.getElementById('signup-step2').style.display='block';
  document.getElementById('signup-step-num').textContent='2';
}
function signupBackToStep1(){document.getElementById('signup-step2').style.display='none';document.getElementById('signup-step1').style.display='block';document.getElementById('signup-step-num').textContent='1';document.getElementById('signup-error2').style.display='none';}
function doSignup(){
  var name=document.getElementById('signup-name').value.trim();
  var email=document.getElementById('signup-email').value.trim();
  var pass=document.getElementById('signup-password').value;
  var err=document.getElementById('signup-error2');
  err.style.display='none';
  var contacts=[];
  for(var i=1;i<=5;i++){var el=document.getElementById('contact-'+i);if(el&&el.value.trim())contacts.push(el.value.trim());}
  if(contacts.length<1){err.textContent='Please enter at least 1 family contact number.';err.style.display='block';return;}
  var users=getUsers();
  users.push({name:name,email:email,pass:pass,contacts:contacts});
  localStorage.setItem('ll_users',JSON.stringify(users));
  setCurrentUser({name:name,email:email,contacts:contacts});
  enterApp();
}
function doLogin(){
  var email=document.getElementById('login-email').value.trim();
  var pass=document.getElementById('login-password').value;
  var err=document.getElementById('login-error');
  err.style.display='none';
  if(!email||!pass){err.textContent='Please enter email and password.';err.style.display='block';return;}
  var users=getUsers();
  var user=users.find(function(u){return u.email===email&&u.pass===pass;});
  if(!user){err.textContent='Incorrect email or password.';err.style.display='block';return;}
  setCurrentUser({name:user.name,email:user.email,contacts:user.contacts});
  enterApp();
}
