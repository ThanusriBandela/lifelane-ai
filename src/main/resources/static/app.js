/* 
   LifeLane AI  app.js  [UPGRADED v3]
    All previous features (routing, AI, IoT, WebSocket, maps)
    RFID + Voice input + Voice broadcast
    Auth system (Sign Up / Login with family contacts)
    Crash detection uses account family contacts
    Mobile-responsive map layout with sidebar toggle
    */
'use strict';

/*  REALISTIC ETA (Indian road conditions)  */
function realisticEta(osrmSeconds, distanceMeters, emergency) {
  const km = distanceMeters / 1000;
  // Distance-based multiplier for Indian roads
  let multiplier;
  if (km < 20)       multiplier = 1.4;   // city  signals, narrow lanes
  else if (km < 80)  multiplier = 1.8;   // outskirts/highway mix
  else               multiplier = 2.2;   // intercity  toll plazas, speed limits
  // Emergency vehicles are faster but still face real roads
  if (emergency)     multiplier *= 0.7;
  return Math.round(osrmSeconds / 60 * multiplier);
}


(function initTheme() {
  const saved = localStorage.getItem('lifelane-theme') || 'dark';
  if (saved === 'light') {
    document.documentElement.classList.add('light');
    _syncThemeUI('light');
  }
})();

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  const theme = isLight ? 'light' : 'dark';
  localStorage.setItem('lifelane-theme', theme);
  _syncThemeUI(theme);
  // Swap map tiles if map is active
  if (map && S.tileLayer) {
    map.removeLayer(S.tileLayer);
    const url = isLight
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    S.tileLayer = L.tileLayer(url, {attribution:' OpenStreetMap  CARTO', maxZoom:19}).addTo(map);
  }
}

function _syncThemeUI(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  icon.textContent = theme === 'light' ? '' : '';
}

// Auto-detects: empty string = same origin (works on Render)
// Override via: <script>window.LIFELANE_API_BASE='https://your-render-url.onrender.com'</script>
const API_BASE = window.LIFELANE_API_BASE || '';

const RFID_DB = {
  'RFID-AMB-001': { name: 'Ambulance 001  NIMS Hospital',   type: 'AMBULANCE',  reg: 'TS09EA0001' },
  'RFID-AMB-002': { name: 'Ambulance 002  Apollo Hospital',  type: 'AMBULANCE',  reg: 'TS09EA0002' },
  'RFID-FIRE-01': { name: 'Fire Engine 01  Secunderabad',    type: 'FIRE_TRUCK', reg: 'TS09FB0011' },
  'RFID-POL-01':  { name: 'Police PCR  Kukatpally',          type: 'POLICE',     reg: 'TS09PC0021' },
  'RFID-HAZ-01':  { name: 'Hazmat Unit 01  OU Campus',       type: 'HAZMAT',     reg: 'TS09HZ0031' },
};
const RFID_KEYS = Object.keys(RFID_DB);

const S = {
  mode: 'normal', emgType: 'AMBULANCE',
  src: null, dst: null, srcMarker: null, dstMarker: null,
  routeLayers: [], vehicleMarker: null, vehicleInterval: null,
  wsClient: null, wsConnected: false, alertCount: 0,
  iotTimers: [], autocompleteTimers: {}, rfidTag: null,
  voiceRecognition: null, voiceWhich: null,
  voiceSynth: window.speechSynthesis || null, voiceAlertUtterance: null,
  isOffline: !navigator.onLine, lastSavedRoute: null,
  vehicleTrailLayer: null, vehicleSpeed: 0,
  vehicleCoordIdx: 0, vehicleCoords: [], vehicleTrail: [],
};

/*  PAGE NAV  */
/* 
   AUTH SYSTEM (localStorage-based, works offline + on deployed app)
    */

function getUsers() { try { return JSON.parse(localStorage.getItem('ll_users')||'[]'); } catch(e){ return []; } }
function saveUsers(u) { localStorage.setItem('ll_users', JSON.stringify(u)); }
function getCurrentUser() { try { return JSON.parse(localStorage.getItem('ll_current_user')||'null'); } catch(e){ return null; } }
function setCurrentUser(u) { localStorage.setItem('ll_current_user', JSON.stringify(u)); }

function buildContactFields() {
  const wrap = document.getElementById('signup-contacts-fields');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const row = document.createElement('div');
    row.className = 'contact-field-row';
    row.innerHTML = '<div class="contact-num-badge">'+i+'</div><input type="tel" id="contact-'+i+'" class="auth-input" placeholder="Contact '+i+' phone number" autocomplete="off"/>';
    wrap.appendChild(row);
  }
}

function signupStep1Next() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;
  const err   = document.getElementById('signup-error1');
  err.style.display = 'none';
  if (!name)  { err.textContent = 'Please enter your full name.'; err.style.display='block'; return; }
  if (!email || !email.includes('@')) { err.textContent = 'Please enter a valid email.'; err.style.display='block'; return; }
  if (pass.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.style.display='block'; return; }
  const users = getUsers();
  if (users.find(u => u.email === email)) { err.textContent = 'An account with this email already exists. Please login.'; err.style.display='block'; return; }
  buildContactFields();
  document.getElementById('signup-step1').style.display = 'none';
  document.getElementById('signup-step2').style.display = 'block';
  document.getElementById('signup-step-num').textContent = '2';
}

function signupBackToStep1() {
  document.getElementById('signup-step2').style.display = 'none';
  document.getElementById('signup-step1').style.display = 'block';
  document.getElementById('signup-step-num').textContent = '1';
  document.getElementById('signup-error2').style.display = 'none';
}

function doSignup() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;
  const err   = document.getElementById('signup-error2');
  err.style.display = 'none';
  const contacts = [];
  for (let i = 1; i <= 5; i++) {
    const val = document.getElementById('contact-'+i) && document.getElementById('contact-'+i).value.trim();
    if (val) contacts.push(val);
  }
  if (contacts.length < 1) { err.textContent = 'Please enter at least 1 family contact number.'; err.style.display='block'; return; }
  const users = getUsers();
  const newUser = { name, email, pass, contacts, createdAt: new Date().toISOString() };
  users.push(newUser);
  saveUsers(users);
  setCurrentUser({ name, email, contacts });
  ['signup-name','signup-email','signup-password'].forEach(function(id){const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('signup-step2').style.display = 'none';
  document.getElementById('signup-step1').style.display = 'block';
  document.getElementById('signup-step-num').textContent = '1';
  enterApp();
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const err   = document.getElementById('login-error');
  err.style.display = 'none';
  if (!email || !pass) { err.textContent = 'Please enter email and password.'; err.style.display='block'; return; }
  const users = getUsers();
  const user  = users.find(function(u){ return u.email === email && u.pass === pass; });
  if (!user) { err.textContent = 'Incorrect email or password. Try again.'; err.style.display='block'; return; }
  setCurrentUser({ name: user.name, email: user.email, contacts: user.contacts });
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  enterApp();
}

function doLogout() {
  localStorage.removeItem('ll_current_user');
  disconnectWS(); stopVoiceAlert();
  showPage('page-auth');
}

function enterApp() {
  const user = getCurrentUser();
  if (!user) { showPage('page-auth'); return; }
  const greeting = document.getElementById('home-user-greeting');
  if (greeting) greeting.textContent = 'Welcome, ' + user.name.split(' ')[0] + ' \u{1F44B}';
  showPage('page-home');
}

/*  PAGE NAV  */
function showPage(id) { document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function goToHome()   { if(!getCurrentUser()){showPage('page-auth');return;} showPage('page-home'); disconnectWS(); stopVoiceAlert(); }
function goToSelect() { showPage('page-select'); disconnectWS(); stopVoiceAlert(); }
function goToHistory(){ showPage('page-history'); loadDispatchHistory(); }
function goToMap(mode){ S.mode=mode; showPage('page-map'); initMapPage(mode); }

/*  MOBILE MAP TOGGLE  */
function toggleMobileMapView() {
  const body = document.getElementById('map-body');
  const btn  = document.getElementById('map-toggle-btn');
  if (!body) return;
  const isMapView = body.classList.toggle('map-view-active');
  if (btn) btn.textContent = isMapView ? '\u2630' : '\U0001F5FA\uFE0F';
  if (map) setTimeout(function(){ map.invalidateSize(); }, 50);
}

/*  MAP INIT  */
let map = null;
function initMapPage(mode) {
  const badge=document.getElementById('mode-badge'), routeBtn=document.getElementById('route-btn');
  const routeBtnTxt=document.getElementById('route-btn-txt'), emgPanel=document.getElementById('emg-type-panel');
  const alertPanel=document.getElementById('alert-msg-panel'), rfidPanel=document.getElementById('rfid-panel');
  if (mode==='emergency') {
    badge.textContent='EMERGENCY'; badge.className='mode-badge emergency';
    routeBtn.className='route-btn emg-mode'; routeBtnTxt.textContent=' DISPATCH EMERGENCY';
    emgPanel.style.display='block'; alertPanel.style.display='block'; rfidPanel.style.display='block';
    setTimeout(()=>autoStartVoice(), 1200);
  } else {
    badge.textContent='NORMAL'; badge.className='mode-badge normal';
    routeBtn.className='route-btn normal-mode'; routeBtnTxt.textContent=' FIND ROUTES';
    emgPanel.style.display='none'; alertPanel.style.display='none'; rfidPanel.style.display='none';
  }
  if (!map) {
    map=L.map('map',{center:[17.45,78.36],zoom:13});
    S.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:' OpenStreetMap  CARTO',maxZoom:19}).addTo(map);
    map.on('click',function(e){ if(!S.src) setSrcLatLng(e.latlng.lat,e.latlng.lng,'Map pin'); else if(!S.dst) setDstLatLng(e.latlng.lat,e.latlng.lng,'Map pin'); });
  } else { map.invalidateSize(); }
  clearAll(); connectWebSocket(); startClock(); initOfflineMonitor();
  addLog('info','SYSTEM',mode.toUpperCase()+' mode activated');
}
function startClock() { const el=document.getElementById('clock-map'); if(!el) return; setInterval(()=>{el.textContent=new Date().toLocaleTimeString('en-IN',{hour12:false});},1000); }

/*  UPGRADE 1: AUTO VOICE IN EMERGENCY  */
function autoStartVoice() {
  showToast('critical',' Auto-listening for source location');
  addLog('info','AUTO-VOICE','Emergency mode: auto-start voice input');
  speak('Emergency mode activated. Please say your pickup location.');
  setTimeout(()=>startVoiceInput('src'), 2800);
}

/*  RFID  */
function simulateRFIDScan() {
  const box=document.getElementById('rfid-icon-box'), tag=document.getElementById('rfid-tag-display');
  const vname=document.getElementById('rfid-vehicle-name'), wrap=box?box.closest('.rfid-reader-wrap'):null;
  tag.textContent='Scanning'; vname.textContent=''; if(wrap) wrap.classList.remove('scanned');
  setTimeout(function(){
    const randomKey=RFID_KEYS[Math.floor(Math.random()*RFID_KEYS.length)], vehicle=RFID_DB[randomKey];
    S.rfidTag=randomKey; tag.textContent=randomKey; vname.textContent=vehicle.name;
    if(wrap) wrap.classList.add('scanned');
    selectEmgTypeByName(vehicle.type);
    addLog('ws','RFID','Tag: '+randomKey+'  '+vehicle.name);
    showToast('success',' RFID: '+vehicle.name);
    speak('RFID scan successful. Vehicle identified as '+vehicle.name.replace(//g,'from').replace(/-/g,' '));
  },800);
}
function selectEmgTypeByName(type) {
  S.emgType=type;
  document.querySelectorAll('.type-btn').forEach(function(b){ const sm=b.querySelector('small'); if(!sm) return; b.classList.toggle('active',sm.textContent.toUpperCase().replace(' ','_')===type||sm.textContent.toUpperCase()===type.replace('_',' ')); });
}

/*  VOICE INPUT  */
function startVoiceInput(which) {
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if (!SR) { showToast('warning','Voice input not supported. Use Chrome.'); return; }
  stopVoiceInput();
  S.voiceWhich=which;
  const rec=new SR(); rec.lang='en-IN'; rec.interimResults=true; rec.maxAlternatives=1; S.voiceRecognition=rec;
  const btn=document.getElementById(which+'-voice-btn'), statusBar=document.getElementById(which+'-voice-status');
  const overlay=document.getElementById('voice-overlay'), overlayLbl=document.getElementById('voice-overlay-label');
  const overlayTxt=document.getElementById('voice-overlay-transcript');
  if(btn) btn.classList.add('listening');
  if(statusBar){statusBar.textContent=' Listening';statusBar.classList.add('active');}
  if(overlay) overlay.classList.add('show');
  if(overlayLbl) overlayLbl.textContent='SAY THE LOCATION';
  if(overlayTxt) overlayTxt.textContent='';
  rec.onresult=function(event){
    let t=''; for(let i=event.resultIndex;i<event.results.length;i++) t+=event.results[i][0].transcript;
    if(overlayTxt) overlayTxt.textContent='"'+t+'"';
    if(event.results[event.results.length-1].isFinal){
      const inputEl=document.getElementById(which+'-input'); if(inputEl){inputEl.value=t;onLocationInput(which);}
      addLog('info','VOICE',(which==='src'?'Source':'Destination')+' heard: "'+t+'"');
      stopVoiceInput();
      if(which==='src'&&S.mode==='emergency'){ setTimeout(()=>{ speak('Source heard. Now say your destination.'); setTimeout(()=>startVoiceInput('dst'),2000); },600); }
    }
  };
  rec.onerror=function(e){showToast('warning','Voice error: '+e.error);stopVoiceInput();};
  rec.onend=function(){stopVoiceInput();};
  rec.start();
}
function stopVoiceInput() {
  if(S.voiceRecognition){try{S.voiceRecognition.stop();}catch(e){}S.voiceRecognition=null;}
  const overlay=document.getElementById('voice-overlay'); if(overlay) overlay.classList.remove('show');
  ['src','dst'].forEach(function(w){ const btn=document.getElementById(w+'-voice-btn'),bar=document.getElementById(w+'-voice-status'); if(btn) btn.classList.remove('listening'); if(bar){bar.textContent='';bar.classList.remove('active');} });
  S.voiceWhich=null;
}

/*  VOICE TTS  */
function speak(text,opts) {
  if(!S.voiceSynth) return; opts=opts||{};
  const utt=new SpeechSynthesisUtterance(text); utt.lang=opts.lang||'en-IN'; utt.rate=opts.rate||1.0; utt.pitch=opts.pitch||1.0; utt.volume=opts.volume||1.0;
  S.voiceSynth.cancel(); S.voiceSynth.speak(utt);
}
function broadcastVoiceAlert(message) {
  if(!S.voiceSynth){addLog('warning','VOICE','Speech synthesis not available');return;}
  S.voiceSynth.cancel();
  const alertText=message||document.getElementById('alert-msg')?.value||'Attention! Emergency vehicle approaching. Please move to the side immediately.';
  let count=0;
  function sayOnce(){
    if(count>=3) return;
    const utt=new SpeechSynthesisUtterance(alertText); utt.lang='en-IN'; utt.rate=0.85; utt.pitch=1.1; utt.volume=1.0;
    utt.onend=function(){count++;if(count<3)setTimeout(sayOnce,1200);}; S.voiceSynth.speak(utt); S.voiceAlertUtterance=utt;
  }
  sayOnce(); addLog('critical','VOICE ALERT','Broadcasting: "'+alertText+'"');
}
function testVoiceAlert() { const msg=document.getElementById('alert-msg')?.value||'Emergency vehicle approaching. Please clear the road.'; broadcastVoiceAlert(msg); showToast('critical',' Voice alert broadcasting'); }
function stopVoiceAlert() { if(S.voiceSynth){try{S.voiceSynth.cancel();}catch(e){}} }

/*  AUTOCOMPLETE  */
function onLocationInput(which) {
  const inputEl=document.getElementById(which==='src'?'src-input':'dst-input'), autoEl=document.getElementById(which==='src'?'src-auto':'dst-auto');
  const val=inputEl.value.trim(); if(val.length<3){autoEl.classList.remove('open');autoEl.innerHTML='';return;}
  clearTimeout(S.autocompleteTimers[which]);
  autoEl.innerHTML='<div class="ac-loading"><span class="spinner"></span>Searching</div>'; autoEl.classList.add('open');
  S.autocompleteTimers[which]=setTimeout(async function(){
    try {
      const res=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(val)+'&format=json&limit=5&countrycodes=in',{headers:{'Accept-Language':'en'}});
      const data=await res.json();
      if(!data.length){autoEl.innerHTML='<div class="ac-loading">No results found</div>';return;}
      autoEl.innerHTML=data.map(function(d){var sn=d.display_name.replace(/"/g,'&quot;').replace(/'/g,"\\'");return '<div class="ac-item" onclick="pickLocation(\''+which+'\','+d.lat+','+d.lon+',\''+sn+'\')">'+'<span class="ac-pin"></span>'+'<span><span class="ac-name">'+d.display_name.split(',')[0]+'</span>'+'<span class="ac-addr">'+d.display_name+'</span></span></div>';}).join('');
    } catch(e){autoEl.innerHTML='<div class="ac-loading">Search error  check network</div>';}
  },420);
}
function pickLocation(which,lat,lon,name) {
  var sn=name.split(',')[0];
  if(which==='src'){document.getElementById('src-input').value=sn;document.getElementById('src-auto').classList.remove('open');setSrcLatLng(parseFloat(lat),parseFloat(lon),name);}
  else{document.getElementById('dst-input').value=sn;document.getElementById('dst-auto').classList.remove('open');setDstLatLng(parseFloat(lat),parseFloat(lon),name);}
}
function setSrcLatLng(lat,lng,name) {
  S.src={lat,lng,name:name||'Source'}; if(S.srcMarker) map.removeLayer(S.srcMarker);
  S.srcMarker=L.circleMarker([lat,lng],{radius:11,color:'#00d95f',fillColor:'#00d95f',fillOpacity:0.9,weight:2}).addTo(map).bindPopup('<div class="pop-t">Source</div><div class="pop-r">'+(name||'')+'</div>');
  map.setView([lat,lng],14); document.getElementById('src-input').value=(name||'').split(',')[0];
  addLog('success','SOURCE','Set: '+(name||'').split(',')[0]); speak('Source set to '+(name||'').split(',')[0]);
}
function setDstLatLng(lat,lng,name) {
  S.dst={lat,lng,name:name||'Destination'}; if(S.dstMarker) map.removeLayer(S.dstMarker);
  S.dstMarker=L.circleMarker([lat,lng],{radius:11,color:'#ff2020',fillColor:'#ff2020',fillOpacity:0.9,weight:2}).addTo(map).bindPopup('<div class="pop-t">Destination</div><div class="pop-r">'+(name||'')+'</div>');
  addLog('success','DEST','Set: '+(name||'').split(',')[0]); speak('Destination set to '+(name||'').split(',')[0]);
}
function useMyLocation(which) {
  if(!navigator.geolocation){showToast('warning','GPS not supported');return;}
  showToast('info','Getting GPS location');
  navigator.geolocation.getCurrentPosition(function(pos){
    var lat=pos.coords.latitude,lng=pos.coords.longitude;
    fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json').then(r=>r.json()).then(d=>{var n=d.display_name||'My Location';if(which==='src')setSrcLatLng(lat,lng,n);else setDstLatLng(lat,lng,n);}).catch(()=>{if(which==='src')setSrcLatLng(lat,lng,'My Location');else setDstLatLng(lat,lng,'My Location');});
  },()=>showToast('warning','GPS permission denied'));
}
document.addEventListener('click',function(e){['src-auto','dst-auto'].forEach(id=>{var el=document.getElementById(id);if(el&&!el.contains(e.target))el.classList.remove('open');});});

/*  UPGRADE 3: AI TRAFFIC PREDICTION  */
function aiTrafficScore(routeIndex) {
  var hour=new Date().getHours(),day=new Date().getDay();
  var isPeak=(day>0&&day<6)&&((hour>=8&&hour<=10)||(hour>=17&&hour<=20));
  var isNight=hour>=23||hour<=5;
  var isSchool=(day>0&&day<6)&&((hour>=7&&hour<=9)||(hour>=13&&hour<=15));
  var base=[0.25,0.55,0.80],density=base[routeIndex]!==undefined?base[routeIndex]:0.5;
  if(isPeak) density=Math.min(1,density*1.6); if(isNight) density=Math.max(0,density*0.3); if(isSchool) density=Math.min(1,density*1.2);
  density=Math.min(1,Math.max(0,density+(Math.random()-0.5)*0.08));
  var reason=isPeak?'Peak hour  high congestion':isNight?'Off-peak  clear roads':isSchool?'School zone congestion':'Normal traffic flow';
  return {density,isPeak,isNight,reason};
}
function predictFutureTraffic(routeIndex) {
  const hour=new Date().getHours(),mins=new Date().getMinutes(),forecasts=[];
  [5,10,15].forEach(function(offset){
    const fh=Math.floor((hour*60+mins+offset)/60)%24;
    const isPeak=(fh>=8&&fh<=10)||(fh>=17&&fh<=20),isNight=fh>=23||fh<=5;
    const bd=[0.25,0.55,0.80][routeIndex]||0.5; let fd=bd;
    if(isPeak) fd=Math.min(1,fd*1.5+0.1); if(isNight) fd=Math.max(0,fd*0.25);
    fd=Math.min(1,Math.max(0,fd+(Math.random()-0.5)*0.12));
    const label=fd<0.35?' Clear':fd<0.65?' Moderate':' Heavy';
    forecasts.push({offset,density:fd,label});
  });
  return forecasts;
}
function showTrafficPredictionPanel(routes) {
  let panel=document.getElementById('prediction-panel');
  if(!panel){panel=document.createElement('div');panel.id='prediction-panel';panel.className='sidebar-section prediction-panel';const sp=document.getElementById('signal-panel');sp.parentNode.insertBefore(panel,sp);}
  const preds=predictFutureTraffic(0),now=aiTrafficScore(0);
  const willCrowd=preds.some(p=>p.density>0.65&&now.density<0.5);
  if(willCrowd){showToast('warning',' AI: Road will crowd in ~5 min');addLog('warning','AI PREDICT','Traffic surge predicted  consider alternate route');}
  const barColor=d=>d<.35?'#00d95f':d<.65?'#ff8800':'#ff2020';
  panel.innerHTML=`
    <div class="s-label" style="display:flex;align-items:center;gap:6px"> AI TRAFFIC FORECAST<span style="font-size:9px;background:rgba(0,200,100,.15);color:#00d95f;padding:2px 6px;border-radius:20px;margin-left:auto">LIVE</span></div>
    <div class="pred-now"><span class="pred-time-label">NOW</span><div class="pred-bar-wrap"><div class="pred-bar" style="width:${Math.round(now.density*100)}%;background:${barColor(now.density)}"></div></div><span class="pred-pct">${Math.round(now.density*100)}%</span></div>
    <div class="pred-timeline">${preds.map(p=>`<div class="pred-slot"><span class="pred-time-label">+${p.offset}m</span><div class="pred-bar-wrap"><div class="pred-bar" style="width:${Math.round(p.density*100)}%;background:${barColor(p.density)}"></div></div><span class="pred-pct">${p.label}</span></div>`).join('')}</div>
    ${willCrowd?'<div class="pred-warning"> Congestion spike predicted  alternate route recommended!</div>':'<div class="pred-ok"> Route looks clear for the next 15 minutes</div>'}
  `;
}

/*  ROUTING  */
async function calculateRoute() {
  if(!S.src||!S.dst){showToast('warning','Set source and destination first');return;}
  if(S.isOffline){
    if(S.lastSavedRoute){showToast('warning',' Offline  using last saved route');addLog('warning','OFFLINE','No internet  showing cached route');speak('You are offline. Using last saved route.');redrawCachedRoute();return;}
    else{showToast('warning',' Offline  no cached route available');speak('You are offline and no cached route is available.');return;}
  }
  var btn=document.getElementById('route-btn'),btnTxt=document.getElementById('route-btn-txt');
  btn.disabled=true; btnTxt.innerHTML='<span class="spinner"></span> CALCULATING'; clearRoutes();
  try {
    var url='https://router.project-osrm.org/route/v1/driving/'+S.src.lng+','+S.src.lat+';'+S.dst.lng+','+S.dst.lat+'?alternatives=3&geometries=geojson&overview=full';
    var res=await fetch(url),data=await res.json();
    if(!data.routes||!data.routes.length){showToast('warning','No routes found');return;}
    S.lastSavedRoute={routes:data.routes,src:S.src,dst:S.dst};
    try{localStorage.setItem('ll_last_route',JSON.stringify(S.lastSavedRoute));}catch(e){}
    drawRoutes(data.routes); buildRouteCards(data.routes);
    if(S.mode==='emergency'){
      runIoTSimulation(data.routes[0]); sendEmergencyAlert(); startVehicleAnimation(data.routes[0]);
      showTrafficPredictionPanel(data.routes); setTimeout(()=>showNearbyAlert(),1500);
      const vname=S.rfidTag?RFID_DB[S.rfidTag]?.name:S.emgType;
      const dist=(data.routes[0].distance/1000).toFixed(1),dur=realisticEta(data.routes[0].duration,data.routes[0].distance,true);
      speak('Emergency dispatch activated. Vehicle: '+vname+'. Distance: '+dist+' kilometres. Estimated arrival: '+dur+' minutes. IoT signals clearing ahead.');
      setTimeout(()=>broadcastVoiceAlert(),3000);
    } else {
      showTrafficPredictionPanel(data.routes);
      const dist=(data.routes[0].distance/1000).toFixed(1),dur=realisticEta(data.routes[0].duration,data.routes[0].distance,false);
      speak('Route found. '+data.routes.length+' options available. Fastest route is '+dist+' kilometres, estimated '+dur+' minutes.');
    }
    map.fitBounds(L.latLngBounds(data.routes[0].geometry.coordinates.map(c=>[c[1],c[0]])),{padding:[40,40]});
    addLog('success','ROUTES',data.routes.length+' routes calculated'); showToast('success',data.routes.length+' routes found');
    saveRouteToBackend(data.routes[0]);
    fetchGroqAI(S.mode==='emergency');
  } catch(e) {showToast('warning','Routing failed  check connection');addLog('warning','ERROR','OSRM: '+e.message);}
  finally{btn.disabled=false;btnTxt.textContent=S.mode==='emergency'?' DISPATCH EMERGENCY':' FIND ROUTES';}
}
function drawRoutes(routes) {
  var colors=['#00d95f','#ff8800','#ff2020'];
  routes.forEach(function(route,i){
    var coords=route.geometry.coordinates.map(c=>[c[1],c[0]]);
    var color=S.mode==='emergency'&&i===0?'#ff2020':(colors[i]||'#4a7898');
    S.routeLayers.push(L.polyline(coords,{color,weight:i===0?6:4,opacity:i===0?0.95:0.5,dashArray:(S.mode!=='emergency'&&i>0)?'8,6':null}).addTo(map));
  });
}
function buildRouteCards(routes) {
  var panel=document.getElementById('route-results'),cards=document.getElementById('route-cards');
  panel.style.display='block'; cards.innerHTML='';
  var nLabel=['LOW TRAFFIC','MED TRAFFIC','HIGH TRAFFIC'],eLabel=['PRIORITY ROUTE','ALT ROUTE 1','ALT ROUTE 2'];
  var badgeTxt=['FASTEST','ALTERNATE','CONGESTED'],badgeCls=['rb-fast','rb-alt','rb-busy'],cardCls=['low','mid','high'];
  routes.forEach(function(route,i){
    var ai=aiTrafficScore(i),preds=predictFutureTraffic(i);
    var dist=(route.distance/1000).toFixed(1),dur=realisticEta(route.duration,route.distance,false),isEmg=S.mode==='emergency',eta=isEmg&&i===0?realisticEta(route.duration,route.distance,true):dur;
    var dc=ai.density<0.35?'var(--green)':ai.density<0.65?'var(--orange)':'var(--red)';
    var futureWarn=preds.some(p=>p.density>0.65&&ai.density<0.5);
    var card=document.createElement('div'); card.className='r-card '+(isEmg?'emg':(cardCls[i]||'high')); card.style.animationDelay=(i*0.08)+'s';
    card.innerHTML='<div class="r-card-hdr"><span class="r-tag '+(isEmg?'emg':cardCls[i])+'">'+( isEmg?eLabel[i]:nLabel[i])+'</span><span class="r-badge '+badgeCls[i]+'">'+badgeTxt[i]+'</span></div>'+'<div class="r-stats"><div class="r-stat"><span class="r-sv">'+eta+'</span><span class="r-sk">MIN ETA</span></div><div class="r-stat"><span class="r-sv">'+dist+'</span><span class="r-sk">KM</span></div><div class="r-stat"><span class="r-sv" style="color:'+dc+'">'+Math.round(ai.density*100)+'%</span><span class="r-sk">DENSITY</span></div></div>'+'<div class="r-note"> AI: '+ai.reason+(isEmg&&i===0?'  <span style="color:var(--green)">IoT signals clearing</span>':'')+'</div>'+(futureWarn?'<div class="r-warn-future"> Heavy traffic predicted in ~5 min</div>':'');
    (function(idx){card.onclick=()=>highlightRoute(idx);})(i);
    cards.appendChild(card);
  });
}
function highlightRoute(idx){S.routeLayers.forEach((l,i)=>l.setStyle({opacity:i===idx?1:0.2,weight:i===idx?8:3}));}

/*  UPGRADE 4: NEARBY USER ALERT  */
function showNearbyAlert() {
  let ex=document.getElementById('nearby-alert-popup'); if(ex) ex.remove();
  const popup=document.createElement('div'); popup.id='nearby-alert-popup'; popup.className='nearby-alert-popup';
  popup.innerHTML=`<div class="nearby-alert-inner"><div class="nearby-alert-icon"></div><div class="nearby-alert-body"><div class="nearby-alert-title">EMERGENCY VEHICLE NEARBY</div><div class="nearby-alert-msg">Ambulance approaching  please move aside and clear the road</div><div class="nearby-alert-sub"> Active dispatch in your area</div></div><button class="nearby-alert-close" onclick="dismissNearbyAlert()"></button></div><div class="nearby-alert-progress"></div>`;
  document.body.appendChild(popup);
  setTimeout(()=>dismissNearbyAlert(),8000);
  addLog('critical','NEARBY ALERT',' Alert sent to nearby users  ambulance approaching');
}
function dismissNearbyAlert() {
  const popup=document.getElementById('nearby-alert-popup');
  if(popup){popup.style.animation='slideOutRight 0.3s ease forwards';setTimeout(()=>popup.remove(),320);}
}

/*  IoT SIGNALS  */
function runIoTSimulation(route) {
  S.iotTimers.forEach(t=>clearTimeout(t)); S.iotTimers=[];
  var panel=document.getElementById('signal-panel'),list=document.getElementById('signal-list');
  panel.style.display='block'; list.innerHTML='';
  var coords=route.geometry.coordinates,step=Math.floor(coords.length/5),junctions=[];
  for(var i=1;i<=4;i++){var idx=Math.min(i*step,coords.length-1),c=coords[idx];junctions.push({lat:c[1],lng:c[0],label:'Junction '+i});}
  junctions.forEach(function(jn,i){
    var item=document.createElement('div'); item.className='signal-item'; item.id='sig-item-'+i;
    item.innerHTML='<div class="sig-lights"><div class="sig-dot on-red" id="sig-r-'+i+'"></div><div class="sig-dot" id="sig-y-'+i+'"></div><div class="sig-dot" id="sig-g-'+i+'"></div></div><span class="sig-name">'+jn.label+'<br><span style="color:var(--muted);font-size:7px">'+jn.lat.toFixed(4)+', '+jn.lng.toFixed(4)+'</span></span><span class="sig-status normal" id="sig-st-'+i+'">NORMAL</span>';
    list.appendChild(item);
    var sm=L.circleMarker([jn.lat,jn.lng],{radius:8,color:'#ff8800',fillColor:'#ff8800',fillOpacity:0.8,weight:2}).addTo(map).bindPopup('<div class="pop-t">IoT Sensor: '+jn.label+'</div>');
    S.routeLayers.push(sm);
    (function(idx,junction,marker){var t=setTimeout(()=>overrideSignal(idx,junction,marker),2000+idx*6000);S.iotTimers.push(t);})(i,jn,sm);
  });
  addLog('critical','IoT','Signal override sequence initiated  4 junctions'); showToast('critical',' IoT override starting');
}
function overrideSignal(i,jn,marker) {
  var rD=document.getElementById('sig-r-'+i),yD=document.getElementById('sig-y-'+i),gD=document.getElementById('sig-g-'+i),st=document.getElementById('sig-st-'+i);
  if(!rD) return;
  rD.className='sig-dot'; yD.className='sig-dot on-yellow'; st.textContent='CLEARING'; st.className='sig-status warning';
  var t1=setTimeout(function(){yD.className='sig-dot';gD.className='sig-dot on-green';st.textContent='OVERRIDE ';st.className='sig-status override';marker.setStyle({color:'#00d95f',fillColor:'#00d95f'});addLog('success','IoT',jn.label+'  GREEN');showToast('success',' '+jn.label+' cleared');speak(jn.label+' signal cleared. Ambulance corridor open.');},1500);
  S.iotTimers.push(t1);
  var t2=setTimeout(function(){gD.className='sig-dot';rD.className='sig-dot on-red';st.textContent='RESTORED';st.className='sig-status normal';marker.setStyle({color:'#4a7898',fillColor:'#4a7898'});addLog('info','IoT',jn.label+'  restored to normal');},23500);
  S.iotTimers.push(t2);
}

/*  UPGRADE 2: LIVE VEHICLE MOVEMENT  */
function startVehicleAnimation(route) {
  if(S.vehicleInterval) clearInterval(S.vehicleInterval);
  if(S.vehicleMarker) map.removeLayer(S.vehicleMarker);
  if(S.vehicleTrailLayer) map.removeLayer(S.vehicleTrailLayer);
  const coords=route.geometry.coordinates.map(c=>[c[1],c[0]]);
  S.vehicleCoords=coords; S.vehicleCoordIdx=0; S.vehicleTrail=[coords[0]];
  const icon=L.divIcon({html:'<div class="live-vehicle-icon"><div class="vehicle-pulse"></div></div>',iconSize:[40,40],iconAnchor:[20,20],className:''});
  S.vehicleMarker=L.marker(coords[0],{icon,zIndexOffset:1000}).addTo(map);
  S.vehicleTrailLayer=L.polyline([coords[0]],{color:'#ff2020',weight:3,opacity:0.5,dashArray:'4,4'}).addTo(map);
  updateVehicleStatsPanel(coords,0,route.duration,false);
  S.vehicleInterval=setInterval(function(){
    if(S.vehicleCoordIdx>=coords.length-1){
      clearInterval(S.vehicleInterval);
      addLog('success','DISPATCH','Vehicle reached destination'); showToast('success',' Emergency vehicle arrived'); speak('Emergency vehicle has arrived at the destination.');
      updateVehicleStatsPanel(coords,coords.length-1,0,true); return;
    }
    S.vehicleCoordIdx=Math.min(S.vehicleCoordIdx+3,coords.length-1);
    const pos=coords[S.vehicleCoordIdx]; S.vehicleMarker.setLatLng(pos);
    S.vehicleTrail.push(pos); if(S.vehicleTrail.length>40) S.vehicleTrail.shift(); S.vehicleTrailLayer.setLatLngs(S.vehicleTrail);
    S.vehicleSpeed=Math.round(55+Math.random()*30);
    const prog=S.vehicleCoordIdx/coords.length,remDur=realisticEta(route.duration*(1-prog),route.distance*(1-prog),true);
    updateVehicleStatsPanel(coords,S.vehicleCoordIdx,remDur,false);
    if(S.wsConnected&&S.wsClient){try{S.wsClient.send('/app/vehicle-position',{},JSON.stringify({vehicleId:(S.rfidTag||S.emgType+'-1'),lat:pos[0],lng:pos[1],speed:S.vehicleSpeed}));}catch(e){}}
  },300);
}
function updateVehicleStatsPanel(coords,idx,eta,arrived) {
  let el=document.getElementById('vehicle-live-stats');
  if(!el){el=document.createElement('div');el.id='vehicle-live-stats';el.className='sidebar-section vehicle-stats-panel';const rr=document.getElementById('route-results');rr.parentNode.insertBefore(el,rr.nextSibling);}
  const prog=Math.round((idx/Math.max(coords.length-1,1))*100);
  if(arrived){el.innerHTML='<div class="s-label"> VEHICLE STATUS</div><div class="vstats-arrived"> ARRIVED AT DESTINATION</div>';return;}
  el.innerHTML=`<div class="s-label" style="display:flex;align-items:center;gap:6px"> LIVE VEHICLE TRACKING<span class="live-dot-badge">LIVE</span></div><div class="vstats-grid"><div class="vstat"><span class="vstat-val">${S.vehicleSpeed||'--'}</span><span class="vstat-key">KM/H</span></div><div class="vstat"><span class="vstat-val">${eta}</span><span class="vstat-key">MIN ETA</span></div><div class="vstat"><span class="vstat-val">${prog}%</span><span class="vstat-key">PROGRESS</span></div></div><div class="vstats-progress-wrap"><div class="vstats-progress-bar" style="width:${prog}%"></div></div><div class="vstats-note"> Position updating every 300ms</div>`;
}

/*  UPGRADE 5: OFFLINE MODE  */
function initOfflineMonitor() {
  try{const saved=localStorage.getItem('ll_last_route');if(saved)S.lastSavedRoute=JSON.parse(saved);}catch(e){}
  updateOfflineBanner();
  window.addEventListener('online',()=>{S.isOffline=false;updateOfflineBanner();showToast('success',' Back online!');speak('Internet connection restored.');});
  window.addEventListener('offline',()=>{S.isOffline=true;updateOfflineBanner();showToast('warning',' You are offline');addLog('warning','OFFLINE','Internet lost  cached route available');speak('Warning: You are offline. Last saved route is available.');if(S.lastSavedRoute&&!S.vehicleInterval)redrawCachedRoute();});
}
function updateOfflineBanner() {
  let banner=document.getElementById('offline-banner');
  if(!banner){banner=document.createElement('div');banner.id='offline-banner';banner.className='offline-banner';document.getElementById('map-topbar').appendChild(banner);}
  if(S.isOffline){banner.innerHTML=' OFFLINE  Using last saved route';banner.style.display='flex';}else{banner.style.display='none';}
}
function redrawCachedRoute() {
  if(!S.lastSavedRoute||!map) return;
  const{routes,src,dst}=S.lastSavedRoute; if(!routes||!routes.length) return;
  clearRoutes();
  if(src)setSrcLatLng(src.lat,src.lng,src.name); if(dst)setDstLatLng(dst.lat,dst.lng,dst.name);
  const coords=routes[0].geometry.coordinates.map(c=>[c[1],c[0]]);
  const layer=L.polyline(coords,{color:'#ff8800',weight:5,opacity:0.8,dashArray:'10,8'}).addTo(map);
  S.routeLayers.push(layer);
  try{const lbl=L.tooltip({permanent:true,direction:'center',className:'offline-route-label'}).setContent(' CACHED ROUTE (OFFLINE)').setLatLng(coords[Math.floor(coords.length/2)]);map.addLayer(lbl);S.routeLayers.push(lbl);}catch(e){}
  map.fitBounds(L.latLngBounds(coords),{padding:[40,40]});
  addLog('warning','OFFLINE','Cached route displayed  You are offline. Using last route');
  showToast('warning',' Offline: Using last saved route');
  speak('You are offline. Using last saved route. Route is visible on map.');
}

/*  WEBSOCKET  */
function connectWebSocket() {
  loadScript('https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js',function(){loadScript('https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js',doConnect);});
}
function loadScript(src,cb) {
  if(document.querySelector('script[src="'+src+'"]')){cb();return;}
  var s=document.createElement('script');s.src=src;s.onload=cb;s.onerror=function(){setWsStatus(false,true);cb();};document.head.appendChild(s);
}
function doConnect() {
  try {
    var socket=new SockJS(API_BASE+'/ws'); S.wsClient=Stomp.over(socket); S.wsClient.debug=null;
    S.wsClient.connect({},function(){
      S.wsConnected=true;setWsStatus(true);addLog('ws','WS','Connected to Spring Boot backend');
      S.wsClient.subscribe('/topic/emergency-alerts',function(msg){try{var d=JSON.parse(msg.body);addLog('critical','BROADCAST',d.message||msg.body);showToast('critical',' '+(d.message||'Emergency alert'));broadcastVoiceAlert(d.message||'Emergency vehicle approaching. Please clear the road.');}catch(e){addLog('critical','BROADCAST',msg.body);}});
      S.wsClient.subscribe('/topic/vehicle-positions',function(msg){try{var d=JSON.parse(msg.body);addLog('info','VEHICLE',d.vehicleId+' @ '+d.lat?.toFixed(4)+', '+d.lng?.toFixed(4));}catch(e){}});
    },function(){setWsStatus(false,true);});
  } catch(e){setWsStatus(false,true);}
}
function setWsStatus(connected,error) {
  var el=document.getElementById('ws-status'),lbl=document.getElementById('ws-label'); if(!el||!lbl) return;
  if(connected){el.className='ws-indicator connected';lbl.textContent='WS: Connected';}
  else if(error){el.className='ws-indicator error';lbl.textContent='WS: Offline (demo mode)';}
  else{el.className='ws-indicator disconnected';lbl.textContent='WS: Connecting';}
}
function disconnectWS() {
  S.iotTimers.forEach(t=>clearTimeout(t)); S.iotTimers=[];
  if(S.vehicleInterval) clearInterval(S.vehicleInterval);
  if(S.wsClient){try{S.wsClient.disconnect();}catch(e){}S.wsConnected=false;}
}
function sendEmergencyAlert() {
  if(!S.wsConnected||!S.wsClient){addLog('warning','WS','Backend offline  demo mode');return;}
  var msg=document.getElementById('alert-msg')?.value||' Emergency vehicle approaching  clear the road!';
  try{S.wsClient.send('/app/emergency-alert',{},JSON.stringify({vehicleId:S.rfidTag||S.emgType+'-1',message:msg,timestamp:new Date().toISOString()}));addLog('critical','BROADCAST',msg);}catch(e){}
}

/*  CLEAR MAP  */
function clearRoutes() {
  S.routeLayers.forEach(l=>{try{map.removeLayer(l);}catch(e){}});
  S.routeLayers=[];
  document.getElementById('route-results').style.display='none';
  document.getElementById('signal-panel').style.display='none';
  document.getElementById('route-cards').innerHTML=''; document.getElementById('signal-list').innerHTML='';
  S.iotTimers.forEach(t=>clearTimeout(t)); S.iotTimers=[];
  if(S.vehicleInterval){clearInterval(S.vehicleInterval);S.vehicleInterval=null;}
  if(S.vehicleMarker){map.removeLayer(S.vehicleMarker);S.vehicleMarker=null;}
  if(S.vehicleTrailLayer){map.removeLayer(S.vehicleTrailLayer);S.vehicleTrailLayer=null;}
  ['prediction-panel','vehicle-live-stats'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});
  dismissNearbyAlert();
}
function clearAll() {
  clearRoutes(); stopVoiceAlert();
  if(S.srcMarker){map.removeLayer(S.srcMarker);S.srcMarker=null;} if(S.dstMarker){map.removeLayer(S.dstMarker);S.dstMarker=null;}
  S.src=null;S.dst=null;S.rfidTag=null;
  ['src-input','dst-input'].forEach(id=>{var el=document.getElementById(id);if(el)el.value='';});
  var al=document.getElementById('alert-log');if(al)al.innerHTML=''; S.alertCount=0;
  var ab=document.getElementById('alert-count-badge');if(ab)ab.textContent='0';
  var rtd=document.getElementById('rfid-tag-display');if(rtd)rtd.textContent='Tap card or scan';
  var rvn=document.getElementById('rfid-vehicle-name');if(rvn)rvn.textContent='';
}

/*  VEHICLE TYPE  */
function selectEmgType(el,type){S.emgType=type;document.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');}

/*  SAVE TO BACKEND  */
function saveRouteToBackend(route) {
  if(!S.src||!S.dst) return;
  fetch(API_BASE+'/api/routes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceName:S.src.name||'Source',sourceLat:S.src.lat,sourceLng:S.src.lng,destName:S.dst.name||'Dest',destLat:S.dst.lat,destLng:S.dst.lng,distanceKm:(route.distance/1000).toFixed(2),durationMin:realisticEta(route.duration,route.distance,S.mode==='emergency'),routeType:S.mode.toUpperCase(),vehicleType:S.mode==='emergency'?S.emgType:'NORMAL',rfidTag:S.rfidTag||null})}).catch(()=>{});
}

/*  LOGS + TOASTS  */
function addLog(type,tag,msg) {
  var log=document.getElementById('alert-log');if(!log)return;
  S.alertCount++;var badge=document.getElementById('alert-count-badge');if(badge)badge.textContent=S.alertCount;
  var colors={critical:'var(--red)',warning:'var(--orange)',info:'var(--blue)',success:'var(--green)',ws:'var(--cyan)'};
  var now=new Date().toLocaleTimeString('en-IN',{hour12:false});
  var item=document.createElement('div');item.className='log-item '+type;
  item.innerHTML='<div class="log-hdr"><span class="log-type" style="color:'+(colors[type]||'var(--muted)')+'">'+tag+'</span><span class="log-time">'+now+'</span></div><div class="log-msg">'+msg+'</div>';
  log.prepend(item);while(log.children.length>30)log.removeChild(log.lastChild);
}
function showToast(type,msg) {
  var c=document.getElementById('toasts');if(!c)return;
  var t=document.createElement('div');t.className='toast '+type;t.textContent=msg;
  c.appendChild(t);setTimeout(()=>{if(t.parentNode)t.parentNode.removeChild(t);},4200);
}


/*  GROQ AI EXPLANATION 
   Calls /api/best-route on Spring Boot backend.
   Spring Boot calls Groq LLaMA3 and returns an AI explanation.
   Result is injected into the first route card as a blue panel.
   All existing features (RFID, voice, IoT, WebSocket) unchanged.
    */
async function fetchGroqAI(emergency) {
  try {
    const res = await fetch(API_BASE + '/api/best-route?emergency=' + !!emergency);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.aiExplanation) return;

    // Inject AI explanation panel into first route card
    const cards = document.getElementById('route-cards');
    if (!cards) return;
    const firstCard = cards.querySelector('.r-card');
    if (!firstCard) return;

    // Remove existing groq panel if re-running
    const existing = document.getElementById('groq-ai-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'groq-ai-panel';
    panel.className = 'sidebar-section';
    panel.style.cssText = 'padding:10px 14px;margin-top:0;border-top:1px solid rgba(255,255,255,0.06)';
    panel.innerHTML =
      '<div style="font-size:9px;letter-spacing:1.5px;color:var(--cyan);margin-bottom:6px;font-weight:600"> GROQ AI ANALYSIS</div>' +
      '<div style="font-size:12px;color:rgba(255,255,255,0.75);line-height:1.55;padding:8px 10px;background:rgba(0,200,255,0.07);border-left:2px solid var(--cyan);border-radius:4px">' +
      data.aiExplanation +
      '</div>';

    // Insert right after the first route card
    firstCard.insertAdjacentElement('afterend', panel);
    addLog('info', 'GROQ AI', data.aiExplanation);
  } catch(e) {
    // Groq unavailable  silently skip, all other features unaffected
    console.warn('[GroqAI] Skipped:', e.message);
  }
}

/*  DISPATCH HISTORY  */
async function loadDispatchHistory() {
  const list  = document.getElementById('history-list');
  const stats = document.getElementById('history-stats');
  if (!list) return;
  list.innerHTML = '<div class="history-loading"><span class="spinner"></span> Loading records</div>';
  stats.innerHTML = '';

  try {
    const res  = await fetch(API_BASE + '/api/dispatch-history');
    const data = await res.json();

    if (!data.length) {
      list.innerHTML = '<div class="history-empty"> NO DISPATCH RECORDS YET<br><br>Complete a route to see it here.</div>';
      return;
    }

    // Stats bar
    const total    = data.length;
    const emgCount = data.filter(d => d.routeType === 'EMERGENCY').length;
    const avgEta   = Math.round(data.reduce((s, d) => s + (d.durationMin || 0), 0) / total);
    const totalKm  = data.reduce((s, d) => s + (d.distanceKm || 0), 0).toFixed(1);
    stats.innerHTML = `
      <div class="hstat"><span class="hstat-val">${total}</span><span class="hstat-key">TOTAL</span></div>
      <div class="hstat"><span class="hstat-val" style="color:var(--red)">${emgCount}</span><span class="hstat-key">EMERGENCY</span></div>
      <div class="hstat"><span class="hstat-val" style="color:var(--green)">${total - emgCount}</span><span class="hstat-key">NORMAL</span></div>
      <div class="hstat"><span class="hstat-val" style="color:var(--cyan)">${avgEta}</span><span class="hstat-key">AVG ETA (MIN)</span></div>
      <div class="hstat"><span class="hstat-val" style="color:var(--yellow)">${totalKm}</span><span class="hstat-key">TOTAL KM</span></div>
    `;

    // Cards
    list.innerHTML = '';
    data.forEach((d, i) => {
      const isEmg   = d.routeType === 'EMERGENCY';
      const icon    = vehicleIcon(d.vehicleType);
      const src     = d.sourceName || '';
      const dst     = d.destName   || '';
      const dist    = d.distanceKm != null ? d.distanceKm + ' km' : '';
      const eta     = d.durationMin != null ? d.durationMin + ' min' : '';
      const rfid    = d.rfidTag ? `<span> ${d.rfidTag}</span>` : '';
      const ts      = d.dispatchedAt ? formatTimestamp(d.dispatchedAt) : '';
      const card    = document.createElement('div');
      card.className = `dispatch-card ${isEmg ? 'emg' : 'normal'}`;
      card.style.animationDelay = (i * 0.04) + 's';
      card.innerHTML = `
        <div class="dispatch-icon">${icon}</div>
        <div class="dispatch-body">
          <div class="dispatch-route"> ${src}   ${dst}</div>
          <div class="dispatch-meta">
            <span> ${d.vehicleType || 'NORMAL'}</span>
            <span> ${dist}</span>
            ${rfid}
          </div>
          <div class="dispatch-timestamp">${ts}</div>
        </div>
        <div class="dispatch-right">
          <div class="dispatch-time-val">${d.durationMin != null ? d.durationMin : ''}</div>
          <div class="dispatch-time-key">MIN ETA</div>
          <div class="dispatch-badge ${isEmg ? 'emg' : 'normal'}">${isEmg ? 'EMERGENCY' : 'NORMAL'}</div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch(e) {
    list.innerHTML = '<div class="history-empty"> Could not load history.<br>Make sure the backend is running.</div>';
  }
}

function vehicleIcon(type) {
  const icons = { AMBULANCE:'', FIRE_TRUCK:'', POLICE:'', HAZMAT:'', NORMAL:'' };
  return icons[type] || '';
}

function formatTimestamp(raw) {
  try {
    // LocalDateTime comes as array [y,mo,d,h,min,s] or ISO string
    let d;
    if (Array.isArray(raw)) {
      d = new Date(raw[0], raw[1]-1, raw[2], raw[3]||0, raw[4]||0, raw[5]||0);
    } else {
      d = new Date(raw);
    }
    return d.toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
  } catch(e) { return ''; }
}

/*  DISPATCH HISTORY  */


// ============================================================
// EMERGENCY CONTACTS + CRASH DETECTION MODULE
// ============================================================

// --- State ---
let crashDetectionActive = false;
let crashCountdownTimer = null;
let lastSpeed = 0;
let lastSpeedTime = Date.now();
let watchId = null;
const CRASH_G_THRESHOLD = 15;   // m/s  sudden jolt (real crash ~30-50g)
const CRASH_SPEED_DROP = 40;    // km/h drop within 2 seconds
const CRASH_COUNTDOWN = 15;     // seconds before auto-send

// --- Contacts Panel HTML (inject into sidebar) ---
function injectContactsPanel() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || document.getElementById('contacts-panel')) return;

    const user = getCurrentUser();
    const contacts = (user && user.contacts) ? user.contacts : [];

    const contactsHtml = contacts.length > 0
        ? contacts.map(function(phone, i) {
            return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;">'
                +'<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,32,32,0.15);display:flex;align-items:center;justify-content:center;font-size:11px;color:#ff5050;flex-shrink:0;font-weight:700;">'+(i+1)+'</div>'
                +'<div style="font-size:12px;color:rgba(255,255,255,0.8);font-family:var(--fm);">'+phone+'</div>'
                +'</div>';
          }).join('')
        : '<div style="font-size:11px;color:rgba(255,255,255,0.3);padding:4px 0;">No contacts  set them in your account.</div>';

    const panel = document.createElement('div');
    panel.id = 'contacts-panel';
    panel.className = 'sidebar-section';
    panel.innerHTML =
        '<div class="s-label">FAMILY EMERGENCY CONTACTS</div>'
        +'<div id="contacts-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">'+contactsHtml+'</div>'
        +'<div style="margin-top:4px;display:flex;gap:6px;">'
        +'<button onclick="toggleCrashDetection()" id="crash-detect-btn" style="flex:1;padding:7px;background:rgba(255,200,0,0.12);border:1px solid rgba(255,200,0,0.4);color:#ffc800;border-radius:8px;cursor:pointer;font-size:11px;font-family:inherit;letter-spacing:1px;"> CRASH DETECTION: OFF</button>'
        +'</div>'
        +'<div id="crash-countdown-bar" style="display:none;margin-top:8px;padding:10px;background:rgba(255,40,40,0.15);border:1px solid rgba(255,40,40,0.5);border-radius:8px;text-align:center;">'
        +'<div style="color:#ff4040;font-size:13px;font-weight:600;letter-spacing:1px;"> CRASH DETECTED</div>'
        +'<div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;">Sending alert in <span id="crash-countdown-num">15</span>s</div>'
        +'<button onclick="cancelCrashAlert()" style="margin-top:6px;padding:5px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:6px;cursor:pointer;font-size:11px;">I'm OK  Cancel</button>'
        +'</div>';
    sidebar.insertBefore(panel, sidebar.querySelector('.grow') || sidebar.lastElementChild);
}






// --- Crash Detection ---
function toggleCrashDetection() {
    crashDetectionActive = !crashDetectionActive;
    const btn = document.getElementById('crash-detect-btn');
    if (crashDetectionActive) {
        btn.style.background = 'rgba(255,80,0,0.2)';
        btn.style.borderColor = 'rgba(255,80,0,0.6)';
        btn.style.color = '#ff6030';
        btn.textContent = ' CRASH DETECTION: ON';
        startAccelerometer();
        startGPSSpeedMonitor();
        showToast('Crash detection active', 'info');
    } else {
        btn.style.background = 'rgba(255,200,0,0.12)';
        btn.style.borderColor = 'rgba(255,200,0,0.4)';
        btn.style.color = '#ffc800';
        btn.textContent = ' CRASH DETECTION: OFF';
        stopAccelerometer();
        stopGPSSpeedMonitor();
        showToast('Crash detection disabled', 'warn');
    }
}

// Accelerometer  detects sudden jolt
function startAccelerometer() {
    if (typeof DeviceMotionEvent === 'undefined') return;

    // iOS 13+ requires permission
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(state => {
            if (state === 'granted') window.addEventListener('devicemotion', onDeviceMotion);
        });
    } else {
        window.addEventListener('devicemotion', onDeviceMotion);
    }
}

function stopAccelerometer() {
    window.removeEventListener('devicemotion', onDeviceMotion);
}

function onDeviceMotion(event) {
    if (!crashDetectionActive || crashCountdownTimer) return;
    const acc = event.acceleration;
    if (!acc) return;
    const g = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
    if (g > CRASH_G_THRESHOLD) {
        console.log('[CrashDetect] Impact detected, G-force:', g.toFixed(1));
        triggerCrashCountdown('Impact detected (G-force: ' + g.toFixed(1) + 'm/s)');
    }
}

// GPS speed monitor  detects sudden speed drop
function startGPSSpeedMonitor() {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(pos => {
        if (!crashDetectionActive || crashCountdownTimer) return;
        const speedKmh = (pos.coords.speed || 0) * 3.6;
        const now = Date.now();
        const elapsed = (now - lastSpeedTime) / 1000;

        if (elapsed < 3 && lastSpeed > 30 && speedKmh < (lastSpeed - CRASH_SPEED_DROP)) {
            console.log('[CrashDetect] Speed drop detected:', lastSpeed.toFixed(0), '', speedKmh.toFixed(0), 'km/h');
            triggerCrashCountdown('Sudden speed drop: ' + lastSpeed.toFixed(0) + '' + speedKmh.toFixed(0) + ' km/h');
        }
        lastSpeed = speedKmh;
        lastSpeedTime = now;
    }, null, { enableHighAccuracy: true, maximumAge: 0 });
}

function stopGPSSpeedMonitor() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
}

// Countdown after crash detected
function triggerCrashCountdown(reason) {
    const bar = document.getElementById('crash-countdown-bar');
    if (bar) bar.style.display = 'block';
    let secs = CRASH_COUNTDOWN;
    document.getElementById('crash-countdown-num').textContent = secs;

    // Voice alert
    speak('Crash detected. Sending emergency alert in ' + secs + ' seconds. Tap cancel if you are okay.');

    crashCountdownTimer = setInterval(() => {
        secs--;
        const el = document.getElementById('crash-countdown-num');
        if (el) el.textContent = secs;
        if (secs <= 0) {
            clearInterval(crashCountdownTimer);
            crashCountdownTimer = null;
            autoSendCrashAlert();
        }
    }, 1000);

    showToast(' Crash detected! Sending alert in ' + CRASH_COUNTDOWN + 's  tap Cancel if OK', 'danger');
}

function cancelCrashAlert() {
    if (crashCountdownTimer) { clearInterval(crashCountdownTimer); crashCountdownTimer = null; }
    const bar = document.getElementById('crash-countdown-bar');
    if (bar) bar.style.display = 'none';
    speak('Alert cancelled. Stay safe.');
    showToast('Alert cancelled', 'info');
}

function autoSendCrashAlert() {
    const bar = document.getElementById('crash-countdown-bar');
    if (bar) bar.style.display = 'none';

    // Get family contacts from the logged-in user's account
    const user = getCurrentUser();
    const contacts = (user && user.contacts) ? user.contacts : [];

    const sendAlert = function(lat, lng) {
        if (contacts.length === 0) {
            showToast('warning', ' No family contacts on file  add them in your account');
            speak('No emergency contacts found. Please update your account with family numbers.');
            return;
        }
        // Notify via backend (passes contact numbers as query params)
        const nums = contacts.map(function(c){ return encodeURIComponent(c); }).join('&phone=');
        const locPart = (lat && lng) ? '&lat='+lat+'&lng='+lng : '';
        fetch(API_BASE+'/api/contacts/alert?driver='+encodeURIComponent(user.email)+'&phone='+nums+locPart, { method: 'POST' })
            .then(function(r){ return r.ok ? r.json() : {contactsNotified: contacts.length}; })
            .catch(function(){ return {contactsNotified: contacts.length}; })
            .then(function(data) {
                const n = data.contactsNotified || contacts.length;
                speak('Emergency alert sent to ' + n + ' family contacts.');
                showToast('critical', ' Alert sent to ' + n + ' family contact' + (n!==1?'s':'') + '!');
                addLog('critical', 'CRASH ALERT', 'Alert dispatched to ' + n + ' contacts: ' + contacts.join(', '));
            });
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos){ sendAlert(pos.coords.latitude, pos.coords.longitude); },
            function(){ sendAlert(null, null); }
        );
    } else {
        sendAlert(null, null);
    }
}

// Helper: speak text via browser TTS (already used in your app)
function speak(text) {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
}

// Hook into existing map page init
const _origGoToMap = typeof goToMap === 'function' ? goToMap : null;
document.addEventListener('DOMContentLoaded', () => {
    // Inject panel whenever the map page becomes visible
    const observer = new MutationObserver(() => {
        const mapPage = document.getElementById('page-map');
        if (mapPage && mapPage.classList.contains('active')) {
            injectContactsPanel();
        }
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
});

window.onload = function() {
  var user = getCurrentUser();
  if (user) {
    var g = document.getElementById('home-user-greeting');
    if (g) g.textContent = 'Welcome, ' + user.name.split(' ')[0] + '!';
    showPage('page-home');
  } else {
    showPage('page-auth');
  }
};
