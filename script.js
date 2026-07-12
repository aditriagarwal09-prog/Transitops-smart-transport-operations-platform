/* =========================================================================
   TRANSITOPS — Smart Transport Operations Platform (Frontend)
   Talks to the backend REST API (see /backend). No local data mocking —
   every read/write goes through fetch() calls defined in the API layer below.
   ========================================================================= */
/*-------------------------------------------starting of the program----------------------------------------------------*/

/* ---------------- API LAYER ---------------- */
const API_BASE = window.TRANSITOPS_API_BASE || 'http://localhost:4000/api';
let authToken = localStorage.getItem('transitops_token') || null;

async function apiRequest(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (networkErr) {
    throw new Error('Cannot reach the TransitOps API. Is the backend running at ' + API_BASE + '?');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON response */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
const apiGet = (path) => apiRequest('GET', path);
const apiPost = (path, body) => apiRequest('POST', path, body);
const apiPut = (path, body) => apiRequest('PUT', path, body);
const apiDelete = (path) => apiRequest('DELETE', path);

/* ---------------- ICONS ---------------- */
const ICONS = {
  dashboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>',
  vehicles:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13l1.5-5A2 2 0 016.4 6.5h11.2a2 2 0 011.9 1.5L21 13"></path><rect x="2" y="13" width="20" height="6" rx="1.5"></rect><circle cx="7" cy="19" r="1.6"></circle><circle cx="17" cy="19" r="1.6"></circle></svg>',
  drivers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg>',
  trips:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 20l-5-2V6l5 2m0 12l6-2m-6 2V8m6 10l5 2V8l-5-2m0 14V6m0 0L9 8"></path></svg>',
  maintenance:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 015.4-5.4l-3 3-2-2z"></path></svg>',
  fuel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22V6a2 2 0 012-2h6a2 2 0 012 2v16"></path><path d="M3 10h10"></path><path d="M15 8l3 3v7a1.5 1.5 0 003 0v-5l-2.5-3"></path></svg>',
  reports:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M12 20V4M20 20v-7"></path></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>',
  empty:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="18" height="14" rx="2"></rect><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>',
  csv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 3v12m0 0l-4-4m4 4l4-4"></path><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"></path></svg>',
};

/* ---------------- ROLES / RBAC (client-side mirror; server is source of truth) ---------------- */
const ROLES = {
  fleet_manager:  {label:"Fleet Manager",     tabs:["dashboard","vehicles","drivers","trips","maintenance","fuel","reports"]},
  driver:         {label:"Driver",            tabs:["dashboard","trips","vehicles","drivers"]},
  safety_officer: {label:"Safety Officer",    tabs:["dashboard","drivers","trips"]},
  financial_analyst:{label:"Financial Analyst",tabs:["dashboard","fuel","reports"]},
};
const WRITE_ACCESS = {
  vehicles:["fleet_manager"], drivers:["fleet_manager","safety_officer"],
  trips:["driver","fleet_manager"], maintenance:["fleet_manager"],
  fuel:["financial_analyst","fleet_manager","driver"], reports:[],
};
function canWrite(module){ return WRITE_ACCESS[module] && WRITE_ACCESS[module].includes(currentUser.role); }

/* ---------------- APP STATE ---------------- */
let currentUser = null;
let activeTab = "dashboard";
let theme = "dark";
let filters = {};
// client-side cache, populated from the API after login / mutations
let DB = { vehicles: [], drivers: [], trips: [], maintenance: [], fuelLogs: [], expenses: [] };

/* ================= LOGIN LOGIC ================= */
async function renderLoginBoard(){
  document.getElementById('login-board').innerHTML = `
    <div class="board-row"><span class="stat go"></span>Connecting to TransitOps API…</div>`;
  try{
    const demo = await apiGet('/auth/demo-accounts');
    document.getElementById('login-board').innerHTML = `
      <div class="board-row"><span class="stat go"></span>API connected · ${demo.accounts.length} demo accounts ready</div>
      <div class="board-row"><span class="stat go"></span>Fleet utilization board · live</div>
      <div class="board-row"><span class="stat warn"></span>License compliance watch · active</div>`;
    document.getElementById('quick-roles').innerHTML = demo.accounts.map(u=>
      `<button onclick="quickFill('${u.email}')">${u.roleLabel}</button>`
    ).join('');
  }catch(e){
    document.getElementById('login-board').innerHTML = `
      <div class="board-row"><span class="stat danger"></span>Cannot reach backend at ${API_BASE}</div>
      <div class="board-row"><span class="stat danger"></span>Start the backend: <span class="mono">cd backend && npm start</span></div>`;
  }
}
function quickFill(email){
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = 'demo1234';
}
async function attemptLogin(){
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errBox = document.getElementById('login-err');
  errBox.style.display = 'none';
  try{
    const data = await apiPost('/auth/login', { email, password });
    authToken = data.token;
    localStorage.setItem('transitops_token', authToken);
    currentUser = data.user;
    activeTab = ROLES[currentUser.role].tabs[0];
    await loadAllData();
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='block';
    initShell();
  }catch(e){
    errBox.textContent = e.message || 'Invalid email or password.';
    errBox.style.display='block';
  }
}
function logout(){
  currentUser = null; authToken = null;
  localStorage.removeItem('transitops_token');
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-email').value='';
  document.getElementById('login-password').value='';
}
document.getElementById('login-password').addEventListener('keydown', e=>{ if(e.key==='Enter') attemptLogin(); });

// Resume session if a valid token is already stored
async function tryResumeSession(){
  if(!authToken) return;
  try{
    const data = await apiGet('/auth/me');
    currentUser = data.user;
    activeTab = ROLES[currentUser.role].tabs[0];
    await loadAllData();
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='block';
    initShell();
  }catch(e){
    authToken = null; localStorage.removeItem('transitops_token');
  }
}

/* ================= DATA LOADING ================= */
async function loadAllData(){
  const [vehicles, drivers, trips, maintenance, fuelLogs, expenses] = await Promise.all([
    apiGet('/vehicles').catch(()=>[]),
    apiGet('/drivers').catch(()=>[]),
    apiGet('/trips').catch(()=>[]),
    apiGet('/maintenance').catch(()=>[]),
    apiGet('/fuel').catch(()=>[]),
    apiGet('/fuel/expenses').catch(()=>[]),
  ]);
  DB = { vehicles, drivers, trips, maintenance, fuelLogs, expenses };
}

/* ================= THEME ================= */
function toggleTheme(){
  theme = theme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', theme);
}

/* ================= TOASTS ================= */
function toast(msg, type='ok'){
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type==='error' ? ' error' : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 2800);
}

/* ================= SHELL / NAV ================= */
const TAB_META = {
  dashboard:{label:"Dashboard", icon:ICONS.dashboard, sub:"Live fleet KPIs and status board"},
  vehicles:{label:"Vehicles", icon:ICONS.vehicles, sub:"Registry of fleet assets"},
  drivers:{label:"Drivers", icon:ICONS.drivers, sub:"Driver profiles &amp; compliance"},
  trips:{label:"Trips", icon:ICONS.trips, sub:"Dispatch lifecycle management"},
  maintenance:{label:"Maintenance", icon:ICONS.maintenance, sub:"Service records &amp; shop status"},
  fuel:{label:"Fuel &amp; Expenses", icon:ICONS.fuel, sub:"Consumption and cost logging"},
  reports:{label:"Reports", icon:ICONS.reports, sub:"Efficiency, utilization &amp; ROI analytics"},
};
function initShell(){
  document.getElementById('side-avatar').textContent = currentUser.name.split(' ').map(s=>s[0]).join('').slice(0,2);
  document.getElementById('side-name').textContent = currentUser.name;
  document.getElementById('side-role').textContent = ROLES[currentUser.role].label;
  renderNav();
  renderTab();
}
function renderNav(){
  const tabs = ROLES[currentUser.role].tabs;
  document.getElementById('nav-list').innerHTML = tabs.map(t=>{
    const m = TAB_META[t];
    return `<div class="nav-item ${t===activeTab?'active':''}" onclick="goTo('${t}')">${m.icon}<span>${m.label}</span></div>`;
  }).join('');
}
function goTo(tab){ activeTab = tab; renderNav(); renderTab(); }
function renderTab(){
  const m = TAB_META[activeTab];
  const fns = {
    dashboard: renderDashboard, vehicles: renderVehicles, drivers: renderDrivers,
    trips: renderTrips, maintenance: renderMaintenance, fuel: renderFuel, reports: renderReports,
  };
  const container = document.getElementById('main-content');
  if(!ROLES[currentUser.role].tabs.includes(activeTab)){
    container.innerHTML = `<div class="access-denied"><h2>Access restricted</h2><p>Your role (${ROLES[currentUser.role].label}) doesn't have permission to view this module.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="topbar"><div><h1>${m.label}</h1><div class="subtitle">${m.sub}</div></div><div class="topbar-actions" id="topbar-actions"></div></div><div id="tab-body">Loading…</div>`;
  fns[activeTab]();
}

/* ================= HELPERS ================= */
const fmtMoney = n => '₹' + Number(n||0).toLocaleString('en-IN');
const fmtNum = n => Number(n||0).toLocaleString('en-IN');
function daysUntil(dateStr){
  const d = new Date(dateStr); const now = new Date();
  return Math.round((d-now)/86400000);
}
function badge(status){
  const cls = status.toLowerCase().replace(/\s+/g,'-');
  return `<span class="badge ${cls}"><span class="d"></span>${status}</span>`;
}
function vehicleName(id){ const v=DB.vehicles.find(v=>v.id===id); return v ? `${v.name} (${v.regNo})` : '—'; }
function driverName(id){ const d=DB.drivers.find(d=>d.id===id); return d ? d.name : '—'; }
function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ================= MODAL SYSTEM ================= */
function openModal(title, bodyHtml, footHtml){
  document.getElementById('modal-box').innerHTML = `
    <div class="modal-head"><h3>${title}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-foot">${footHtml}</div>`;
  document.getElementById('modal-overlay').classList.add('show');
}
function closeModal(){ document.getElementById('modal-overlay').classList.remove('show'); }
document.getElementById('modal-overlay').addEventListener('click', e=>{ if(e.target.id==='modal-overlay') closeModal(); });

/* ============================================================
   DASHBOARD
   ============================================================ */
async function renderDashboard(){
  let d;
  try{ d = await apiGet('/reports/dashboard'); }
  catch(e){ document.getElementById('tab-body').innerHTML = errorPanel(e); return; }

  document.getElementById('tab-body').innerHTML = `
    <div class="kpi-grid">
      ${kpi('Active Vehicles', d.activeVehicles, `/ ${d.totalVehicles} total`)}
      ${kpi('Available Vehicles', d.availableVehicles, 'ready to dispatch','go')}
      ${kpi('In Maintenance', d.inMaintenance, 'currently in shop','warn')}
      ${kpi('Active Trips', d.activeTrips, 'dispatched now')}
      ${kpi('Pending Trips', d.pendingTrips, 'in draft')}
      ${kpi('Drivers On Duty', d.driversOnDuty, `/ ${d.totalDrivers} total`)}
      ${kpi('Fleet Utilization', d.fleetUtilization+'%', 'on-trip / active','go')}
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Vehicle status board</h3><span class="hint">live registry snapshot</span></div>
        ${vehicleStatusBoard()}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>License &amp; compliance watch</h3><span class="hint">soonest expiry first</span></div>
        ${licenseWatch(d.licenseWatch)}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Recent trips</h3><span class="hint">latest 5</span></div>
      ${recentTripsTable(d.recentTrips)}
    </div>
  `;
}
function kpi(label, value, sub, tone){
  return `<div class="kpi-card ${tone||''}"><div class="kpi-bar"></div><div class="kpi-label">${label}</div><div class="kpi-value">${value} <span>${sub||''}</span></div></div>`;
}
function vehicleStatusBoard(){
  return `<div class="table-scroll"><table><thead><tr><th>Reg No.</th><th>Type</th><th>Region</th><th>Status</th></tr></thead><tbody>
    ${DB.vehicles.map(v=>`<tr><td class="mono">${v.regNo}</td><td>${v.type}</td><td>${v.region}</td><td>${badge(v.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function licenseWatch(items){
  return `<div class="table-scroll"><table><thead><tr><th>Driver</th><th>Expiry</th><th>Days left</th><th>Status</th></tr></thead><tbody>
    ${items.map(d=>`<tr><td>${d.name}</td><td class="mono">${d.licenseExpiry}</td>
      <td class="mono" style="color:${d.daysLeft<0?'var(--danger)':d.daysLeft<90?'var(--warn)':'var(--text-dim)'}">${d.daysLeft<0?'Expired':d.daysLeft+'d'}</td>
      <td>${badge(d.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function recentTripsTable(items){
  return `<div class="table-scroll"><table><thead><tr><th>Trip ID</th><th>Route</th><th>Vehicle</th><th>Driver</th><th>Cargo (kg)</th><th>Status</th></tr></thead><tbody>
    ${items.map(t=>`<tr><td class="mono">${t.id}</td><td>${t.source} → ${t.destination}</td><td>${vehicleName(t.vehicleId)}</td><td>${driverName(t.driverId)}</td><td class="mono">${fmtNum(t.cargoWeight)}</td><td>${badge(t.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function errorPanel(e){
  return `<div class="panel"><div class="empty-state">${ICONS.empty}<div class="t">Couldn't load data</div><div class="hint">${esc(e.message)}</div></div></div>`;
}

/* ============================================================
   VEHICLES
   ============================================================ */
function renderVehicles(){
  filters.vehicles = filters.vehicles || {q:'', status:'All'};
  const f = filters.vehicles;
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = `
    <div class="search-box">${ICONS.search}<input placeholder="Search reg no. or name…" value="${esc(f.q)}" oninput="filters.vehicles.q=this.value; renderVehicles();"></div>
    ${canWrite('vehicles') ? `<button class="btn btn-primary btn-sm" onclick="vehicleForm()">${ICONS.plus} Register vehicle</button>` : ''}
  `;
  const statuses = ['All','Available','On Trip','In Shop','Retired'];
  let list = DB.vehicles.filter(v => (v.regNo+v.name).toLowerCase().includes(f.q.toLowerCase()));
  if(f.status!=='All') list = list.filter(v=>v.status===f.status);

  document.getElementById('tab-body').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div class="pill-filter">${statuses.map(s=>`<button class="${f.status===s?'active':''}" onclick="filters.vehicles.status='${s}'; renderVehicles();">${s}</button>`).join('')}</div>
        <span class="hint">${list.length} of ${DB.vehicles.length} vehicles</span>
      </div>
      ${list.length ? `<div class="table-scroll"><table><thead><tr>
        <th>Reg No.</th><th>Name / Model</th><th>Type</th><th>Max Load</th><th>Odometer</th><th>Acq. Cost</th><th>Status</th><th></th>
      </tr></thead><tbody>
        ${list.map(v=>`<tr>
          <td class="mono">${v.regNo}</td><td>${v.name}</td><td>${v.type}</td>
          <td class="mono">${fmtNum(v.maxLoad)} kg</td><td class="mono">${fmtNum(v.odometer)} km</td>
          <td class="mono">${fmtMoney(v.acqCost)}</td><td>${badge(v.status)}</td>
          <td class="row-actions">${canWrite('vehicles') ? `
            <button class="btn btn-ghost btn-sm" onclick="vehicleForm('${v.id}')">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteVehicle('${v.id}')">Delete</button>` : ''}</td>
        </tr>`).join('')}
      </tbody></table></div>` : emptyState('No vehicles match your filters')}
    </div>`;
}
function vehicleForm(id){
  const v = id ? DB.vehicles.find(x=>x.id===id) : null;
  openModal(v?'Edit vehicle':'Register vehicle', `
    <div class="form-grid">
      <div class="field full"><label>Registration Number *</label><input id="f-regNo" value="${v?esc(v.regNo):''}" placeholder="e.g. UP16-AB-4521"><div class="err-text" id="err-regNo">This registration number already exists.</div></div>
      <div class="field full"><label>Vehicle Name / Model *</label><input id="f-name" value="${v?esc(v.name):''}" placeholder="e.g. Tata Ace Gold"></div>
      <div class="field"><label>Type</label><select id="f-type">
        ${['Mini Truck','LCV','Pickup','Truck','Van','Trailer'].map(t=>`<option ${v&&v.type===t?'selected':''}>${t}</option>`).join('')}
      </select></div>
      <div class="field"><label>Region</label><select id="f-region">
        ${['North','South','East','West'].map(t=>`<option ${v&&v.region===t?'selected':''}>${t}</option>`).join('')}
      </select></div>
      <div class="field"><label>Max Load Capacity (kg) *</label><input id="f-maxLoad" type="number" min="0" value="${v?v.maxLoad:''}"></div>
      <div class="field"><label>Odometer (km)</label><input id="f-odometer" type="number" min="0" value="${v?v.odometer:0}"></div>
      <div class="field"><label>Acquisition Cost (₹)</label><input id="f-acqCost" type="number" min="0" value="${v?v.acqCost:''}"></div>
      <div class="field"><label>Status</label><select id="f-status">
        ${['Available','On Trip','In Shop','Retired'].map(s=>`<option ${v&&v.status===s?'selected':''}>${s}</option>`).join('')}
      </select></div>
    </div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveVehicle('${id||''}')">Save vehicle</button>`);
}
async function saveVehicle(id){
  const regNo = document.getElementById('f-regNo').value.trim();
  const name = document.getElementById('f-name').value.trim();
  const maxLoad = Number(document.getElementById('f-maxLoad').value);
  if(!regNo || !name || !maxLoad){ toast('Please fill all required fields', 'error'); return; }
  const payload = {
    regNo, name, type: document.getElementById('f-type').value, region: document.getElementById('f-region').value,
    maxLoad, odometer: Number(document.getElementById('f-odometer').value)||0,
    acqCost: Number(document.getElementById('f-acqCost').value)||0, status: document.getElementById('f-status').value,
  };
  try{
    if(id){ const updated = await apiPut(`/vehicles/${id}`, payload); const i=DB.vehicles.findIndex(v=>v.id===id); DB.vehicles[i]=updated; toast('Vehicle updated'); }
    else{ const created = await apiPost('/vehicles', payload); DB.vehicles.push(created); toast('Vehicle registered'); }
    closeModal(); renderVehicles();
  }catch(e){
    if(e.status===409){ document.getElementById('err-regNo').style.display='block'; }
    else toast(e.message, 'error');
  }
}
async function deleteVehicle(id){
  try{ await apiDelete(`/vehicles/${id}`); DB.vehicles = DB.vehicles.filter(v=>v.id!==id); toast('Vehicle removed'); renderVehicles(); }
  catch(e){ toast(e.message, 'error'); }
}

/* ============================================================
   DRIVERS
   ============================================================ */
function renderDrivers(){
  filters.drivers = filters.drivers || {q:'', status:'All'};
  const f = filters.drivers;
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = `
    <div class="search-box">${ICONS.search}<input placeholder="Search name or license…" value="${esc(f.q)}" oninput="filters.drivers.q=this.value; renderDrivers();"></div>
    ${canWrite('drivers') ? `<button class="btn btn-primary btn-sm" onclick="driverForm()">${ICONS.plus} Add driver</button>` : ''}
  `;
  const statuses = ['All','Available','On Trip','Off Duty','Suspended'];
  let list = DB.drivers.filter(d => (d.name+d.licenseNo).toLowerCase().includes(f.q.toLowerCase()));
  if(f.status!=='All') list = list.filter(d=>d.status===f.status);

  document.getElementById('tab-body').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div class="pill-filter">${statuses.map(s=>`<button class="${f.status===s?'active':''}" onclick="filters.drivers.status='${s}'; renderDrivers();">${s}</button>`).join('')}</div>
        <span class="hint">${list.length} of ${DB.drivers.length} drivers</span>
      </div>
      ${list.length ? `<div class="table-scroll"><table><thead><tr>
        <th>Name</th><th>License No.</th><th>Category</th><th>Expiry</th><th>Contact</th><th>Safety Score</th><th>Status</th><th></th>
      </tr></thead><tbody>
        ${list.map(d=>{
          const dd = daysUntil(d.licenseExpiry); const expired = dd<0;
          return `<tr>
          <td>${d.name}</td><td class="mono">${d.licenseNo}</td><td>${d.licenseCategory}</td>
          <td class="mono" style="color:${expired?'var(--danger)':dd<90?'var(--warn)':'inherit'}">${d.licenseExpiry}${expired?' ⚠':''}</td>
          <td class="mono">${d.contact}</td><td class="mono">${d.safetyScore}</td><td>${badge(d.status)}</td>
          <td class="row-actions">${canWrite('drivers') ? `
            <button class="btn btn-ghost btn-sm" onclick="driverForm('${d.id}')">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteDriver('${d.id}')">Delete</button>` : ''}</td>
        </tr>`;}).join('')}
      </tbody></table></div>` : emptyState('No drivers match your filters')}
    </div>`;
}
function driverForm(id){
  const d = id ? DB.drivers.find(x=>x.id===id) : null;
  openModal(d?'Edit driver':'Add driver', `
    <div class="form-grid">
      <div class="field full"><label>Name *</label><input id="f-name" value="${d?esc(d.name):''}"></div>
      <div class="field"><label>License Number *</label><input id="f-licenseNo" value="${d?esc(d.licenseNo):''}"></div>
      <div class="field"><label>License Category</label><select id="f-licenseCategory">
        ${['LMV-TR','HMV','MCWG'].map(c=>`<option ${d&&d.licenseCategory===c?'selected':''}>${c}</option>`).join('')}
      </select></div>
      <div class="field"><label>License Expiry Date *</label><input id="f-licenseExpiry" type="date" value="${d?d.licenseExpiry:''}"></div>
      <div class="field"><label>Contact Number</label><input id="f-contact" value="${d?esc(d.contact):''}" placeholder="+91…"></div>
      <div class="field"><label>Safety Score (0-100)</label><input id="f-safetyScore" type="number" min="0" max="100" value="${d?d.safetyScore:85}"></div>
      <div class="field"><label>Status</label><select id="f-status">
        ${['Available','On Trip','Off Duty','Suspended'].map(s=>`<option ${d&&d.status===s?'selected':''}>${s}</option>`).join('')}
      </select></div>
    </div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveDriver('${id||''}')">Save driver</button>`);
}
async function saveDriver(id){
  const name = document.getElementById('f-name').value.trim();
  const licenseNo = document.getElementById('f-licenseNo').value.trim();
  const licenseExpiry = document.getElementById('f-licenseExpiry').value;
  if(!name || !licenseNo || !licenseExpiry){ toast('Please fill all required fields', 'error'); return; }
  const payload = {
    name, licenseNo, licenseCategory: document.getElementById('f-licenseCategory').value, licenseExpiry,
    contact: document.getElementById('f-contact').value.trim(),
    safetyScore: Number(document.getElementById('f-safetyScore').value)||0,
    status: document.getElementById('f-status').value,
  };
  try{
    if(id){ const updated = await apiPut(`/drivers/${id}`, payload); const i=DB.drivers.findIndex(d=>d.id===id); DB.drivers[i]=updated; toast('Driver updated'); }
    else{ const created = await apiPost('/drivers', payload); DB.drivers.push(created); toast('Driver added'); }
    closeModal(); renderDrivers();
  }catch(e){ toast(e.message, 'error'); }
}
async function deleteDriver(id){
  try{ await apiDelete(`/drivers/${id}`); DB.drivers = DB.drivers.filter(d=>d.id!==id); toast('Driver removed'); renderDrivers(); }
  catch(e){ toast(e.message, 'error'); }
}

/* ============================================================
   TRIPS
   ============================================================ */
function renderTrips(){
  filters.trips = filters.trips || {q:'', status:'All'};
  const f = filters.trips;
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = `
    <div class="search-box">${ICONS.search}<input placeholder="Search trip, route…" value="${esc(f.q)}" oninput="filters.trips.q=this.value; renderTrips();"></div>
    ${canWrite('trips') ? `<button class="btn btn-primary btn-sm" onclick="tripForm()">${ICONS.plus} New trip</button>` : ''}
  `;
  const statuses = ['All','Draft','Dispatched','Completed','Cancelled'];
  let list = DB.trips.filter(t => (t.id+t.source+t.destination).toLowerCase().includes(f.q.toLowerCase()));
  if(f.status!=='All') list = list.filter(t=>t.status===f.status);
  list = [...list].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  document.getElementById('tab-body').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div class="pill-filter">${statuses.map(s=>`<button class="${f.status===s?'active':''}" onclick="filters.trips.status='${s}'; renderTrips();">${s}</button>`).join('')}</div>
        <span class="hint">${list.length} of ${DB.trips.length} trips</span>
      </div>
      ${list.length ? `<div class="table-scroll"><table><thead><tr>
        <th>Trip ID</th><th>Route</th><th>Vehicle</th><th>Driver</th><th>Cargo</th><th>Distance</th><th>Status</th><th></th>
      </tr></thead><tbody>
        ${list.map(t=>`<tr>
          <td class="mono">${t.id}</td><td>${t.source} → ${t.destination}</td>
          <td>${vehicleName(t.vehicleId)}</td><td>${driverName(t.driverId)}</td>
          <td class="mono">${fmtNum(t.cargoWeight)} kg</td><td class="mono">${fmtNum(t.plannedDistance)} km</td>
          <td>${badge(t.status)}</td>
          <td class="row-actions">
            ${canWrite('trips') && t.status==='Draft' ? `<button class="btn btn-primary btn-sm" onclick="dispatchTrip('${t.id}')">Dispatch</button>` : ''}
            ${canWrite('trips') && t.status==='Dispatched' ? `<button class="btn btn-ghost btn-sm" onclick="completeTripForm('${t.id}')">Complete</button><button class="btn btn-ghost btn-sm" onclick="cancelTrip('${t.id}')">Cancel</button>` : ''}
            ${!canWrite('trips') ? '<span class="hint">view only</span>' : ''}
          </td>
        </tr>`).join('')}
      </tbody></table></div>` : emptyState('No trips match your filters')}
    </div>`;
}
function tripForm(){
  const availVehicles = DB.vehicles.filter(v=>v.status==='Available');
  const availDrivers = DB.drivers.filter(d=>d.status==='Available' && daysUntil(d.licenseExpiry) >= 0);
  openModal('Create trip', `
    <div class="form-grid">
      <div class="field"><label>Source *</label><input id="f-source" placeholder="e.g. Delhi Hub"></div>
      <div class="field"><label>Destination *</label><input id="f-destination" placeholder="e.g. Jaipur DC"></div>
      <div class="field full"><label>Vehicle * <span class="help-text">(only Available vehicles shown)</span></label>
        <select id="f-vehicleId" onchange="document.getElementById('cap-hint').textContent = this.value ? 'Max load: ' + (DB.vehicles.find(v=>v.id===this.value).maxLoad) + ' kg' : '';">
          <option value="">Select vehicle…</option>
          ${availVehicles.map(v=>`<option value="${v.id}">${v.regNo} — ${v.name} (max ${fmtNum(v.maxLoad)} kg)</option>`).join('')}
        </select>
        <div class="help-text" id="cap-hint"></div>
        ${availVehicles.length===0 ? '<div class="err-text" style="display:block">No vehicles currently available.</div>' : ''}
      </div>
      <div class="field full"><label>Driver * <span class="help-text">(Available, valid license only)</span></label>
        <select id="f-driverId">
          <option value="">Select driver…</option>
          ${availDrivers.map(d=>`<option value="${d.id}">${d.name} — expires ${d.licenseExpiry}</option>`).join('')}
        </select>
        ${availDrivers.length===0 ? '<div class="err-text" style="display:block">No eligible drivers available.</div>' : ''}
      </div>
      <div class="field"><label>Cargo Weight (kg) *</label><input id="f-cargoWeight" type="number" min="0"></div>
      <div class="field"><label>Planned Distance (km) *</label><input id="f-plannedDistance" type="number" min="0"></div>
      <div class="field full"><label>Expected Revenue (₹)</label><input id="f-revenue" type="number" min="0" value="0"></div>
      <div class="err-text full" id="trip-err" style="display:none"></div>
    </div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveTrip()">Save as Draft</button>`);
}
async function saveTrip(){
  const source = document.getElementById('f-source').value.trim();
  const destination = document.getElementById('f-destination').value.trim();
  const vehicleId = document.getElementById('f-vehicleId').value;
  const driverId = document.getElementById('f-driverId').value;
  const cargoWeight = Number(document.getElementById('f-cargoWeight').value);
  const plannedDistance = Number(document.getElementById('f-plannedDistance').value);
  const revenue = Number(document.getElementById('f-revenue').value)||0;
  const errBox = document.getElementById('trip-err');
  if(!source||!destination||!vehicleId||!driverId||!cargoWeight||!plannedDistance){
    errBox.textContent='Please complete all required fields.'; errBox.style.display='block'; return;
  }
  try{
    const trip = await apiPost('/trips', {source, destination, vehicleId, driverId, cargoWeight, plannedDistance, revenue});
    DB.trips.push(trip);
    toast('Trip created as Draft'); closeModal(); renderTrips();
  }catch(e){ errBox.textContent = e.message; errBox.style.display='block'; }
}
async function dispatchTrip(id){
  try{
    const { trip, vehicle, driver } = await apiPost(`/trips/${id}/dispatch`);
    Object.assign(DB.trips.find(t=>t.id===id), trip);
    Object.assign(DB.vehicles.find(v=>v.id===vehicle.id), vehicle);
    Object.assign(DB.drivers.find(d=>d.id===driver.id), driver);
    toast('Trip dispatched — vehicle & driver marked On Trip'); renderTrips();
  }catch(e){ toast(e.message, 'error'); }
}
function completeTripForm(id){
  const t = DB.trips.find(x=>x.id===id);
  const v = DB.vehicles.find(x=>x.id===t.vehicleId);
  openModal('Complete trip '+t.id, `
    <div class="form-grid">
      <div class="field full"><label>Final Odometer (km) *</label><input id="f-finalOdo" type="number" min="${v.odometer}" value="${v.odometer + t.plannedDistance}"></div>
      <div class="field full"><label>Fuel Consumed (liters) *</label><input id="f-fuelConsumed" type="number" min="0"></div>
      <div class="err-text full" id="complete-err" style="display:none"></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="completeTrip('${id}')">Mark completed</button>`);
}
async function completeTrip(id){
  const finalOdometer = Number(document.getElementById('f-finalOdo').value);
  const fuelConsumed = Number(document.getElementById('f-fuelConsumed').value);
  const errBox = document.getElementById('complete-err');
  if(!finalOdometer || isNaN(fuelConsumed)){ errBox.textContent='Enter final odometer and fuel consumed.'; errBox.style.display='block'; return; }
  try{
    const { trip, vehicle, driver, fuelLog } = await apiPost(`/trips/${id}/complete`, { finalOdometer, fuelConsumed });
    Object.assign(DB.trips.find(t=>t.id===id), trip);
    Object.assign(DB.vehicles.find(v=>v.id===vehicle.id), vehicle);
    Object.assign(DB.drivers.find(d=>d.id===driver.id), driver);
    if(fuelLog) DB.fuelLogs.push(fuelLog);
    toast('Trip completed — vehicle & driver now Available'); closeModal(); renderTrips();
  }catch(e){ errBox.textContent = e.message; errBox.style.display='block'; }
}
async function cancelTrip(id){
  try{
    const { trip } = await apiPost(`/trips/${id}/cancel`);
    const localTrip = DB.trips.find(t=>t.id===id);
    const wasDispatched = localTrip.status === 'Dispatched';
    Object.assign(localTrip, trip);
    if(wasDispatched){
      const v = DB.vehicles.find(v=>v.id===localTrip.vehicleId); if(v) v.status='Available';
      const d = DB.drivers.find(d=>d.id===localTrip.driverId); if(d) d.status='Available';
    }
    toast('Trip cancelled'); renderTrips();
  }catch(e){ toast(e.message, 'error'); }
}

/* ============================================================
   MAINTENANCE
   ============================================================ */
function renderMaintenance(){
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = canWrite('maintenance') ? `<button class="btn btn-primary btn-sm" onclick="maintenanceForm()">${ICONS.plus} New maintenance record</button>` : '';
  const list = [...DB.maintenance].sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('tab-body').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Maintenance log</h3><span class="hint">${list.length} records</span></div>
      ${list.length ? `<div class="table-scroll"><table><thead><tr>
        <th>Record ID</th><th>Vehicle</th><th>Type</th><th>Description</th><th>Cost</th><th>Date</th><th>Status</th><th></th>
      </tr></thead><tbody>
        ${list.map(m=>`<tr>
          <td class="mono">${m.id}</td><td>${vehicleName(m.vehicleId)}</td><td>${m.type}</td><td>${esc(m.description)}</td>
          <td class="mono">${fmtMoney(m.cost)}</td><td class="mono">${m.date}</td><td>${badge(m.status)}</td>
          <td class="row-actions">${canWrite('maintenance') && m.status==='Active' ? `<button class="btn btn-ghost btn-sm" onclick="closeMaintenance('${m.id}')">Close</button>` : ''}</td>
        </tr>`).join('')}
      </tbody></table></div>` : emptyState('No maintenance records yet')}
    </div>`;
}
function maintenanceForm(){
  const eligible = DB.vehicles.filter(v=>v.status!=='Retired');
  openModal('New maintenance record', `
    <div class="form-grid">
      <div class="field full"><label>Vehicle *</label><select id="f-vehicleId">
        <option value="">Select vehicle…</option>
        ${eligible.map(v=>`<option value="${v.id}">${v.regNo} — ${v.name}</option>`).join('')}
      </select></div>
      <div class="field"><label>Maintenance Type *</label><input id="f-type" placeholder="e.g. Oil Change"></div>
      <div class="field"><label>Cost (₹)</label><input id="f-cost" type="number" min="0"></div>
      <div class="field full"><label>Description</label><input id="f-description" placeholder="Details…"></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveMaintenance()">Create record</button>`);
}
async function saveMaintenance(){
  const vehicleId = document.getElementById('f-vehicleId').value;
  const type = document.getElementById('f-type').value.trim();
  if(!vehicleId || !type){ toast('Select a vehicle and maintenance type', 'error'); return; }
  try{
    const { record, vehicle } = await apiPost('/maintenance', {
      vehicleId, type, description: document.getElementById('f-description').value.trim(),
      cost: Number(document.getElementById('f-cost').value)||0,
    });
    DB.maintenance.push(record);
    Object.assign(DB.vehicles.find(v=>v.id===vehicle.id), vehicle);
    toast('Maintenance record created — vehicle moved to In Shop'); closeModal(); renderMaintenance();
  }catch(e){ toast(e.message, 'error'); }
}
async function closeMaintenance(id){
  try{
    const { record, vehicle } = await apiPost(`/maintenance/${id}/close`);
    Object.assign(DB.maintenance.find(m=>m.id===id), record);
    if(vehicle) Object.assign(DB.vehicles.find(v=>v.id===vehicle.id), vehicle);
    toast('Maintenance closed — vehicle restored'); renderMaintenance();
  }catch(e){ toast(e.message, 'error'); }
}

/* ============================================================
   FUEL & EXPENSES
   ============================================================ */
function renderFuel(){
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = canWrite('fuel') ? `
    <button class="btn btn-ghost btn-sm" onclick="expenseForm()">${ICONS.plus} Log expense</button>
    <button class="btn btn-primary btn-sm" onclick="fuelForm()">${ICONS.plus} Log fuel</button>` : '';

  document.getElementById('tab-body').innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Fuel logs</h3><span class="hint">${DB.fuelLogs.length} entries</span></div>
        ${DB.fuelLogs.length ? `<div class="table-scroll"><table><thead><tr><th>Vehicle</th><th>Liters</th><th>Cost</th><th>Date</th></tr></thead><tbody>
        ${[...DB.fuelLogs].sort((a,b)=>b.date.localeCompare(a.date)).map(f=>`<tr><td>${vehicleName(f.vehicleId)}</td><td class="mono">${f.liters} L</td><td class="mono">${fmtMoney(f.cost)}</td><td class="mono">${f.date}</td></tr>`).join('')}
        </tbody></table></div>` : emptyState('No fuel logs yet')}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Other expenses</h3><span class="hint">${DB.expenses.length} entries</span></div>
        ${DB.expenses.length ? `<div class="table-scroll"><table><thead><tr><th>Vehicle</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead><tbody>
        ${[...DB.expenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr><td>${vehicleName(e.vehicleId)}</td><td>${e.type}</td><td class="mono">${fmtMoney(e.amount)}</td><td class="mono">${e.date}</td></tr>`).join('')}
        </tbody></table></div>` : emptyState('No expenses logged yet')}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Total operational cost per vehicle</h3><span class="hint">Fuel + Maintenance</span></div>
      ${operationalCostTable()}
    </div>`;
}
function operationalCostTable(){
  return `<div class="table-scroll"><table><thead><tr><th>Vehicle</th><th>Fuel Cost</th><th>Maintenance Cost</th><th>Total Operational Cost</th></tr></thead><tbody>
    ${DB.vehicles.map(v=>{
      const fuel = DB.fuelLogs.filter(f=>f.vehicleId===v.id).reduce((s,f)=>s+f.cost,0);
      const maint = DB.maintenance.filter(m=>m.vehicleId===v.id).reduce((s,m)=>s+m.cost,0);
      return `<tr><td class="mono">${v.regNo}</td><td class="mono">${fmtMoney(fuel)}</td><td class="mono">${fmtMoney(maint)}</td><td class="mono" style="font-weight:600">${fmtMoney(fuel+maint)}</td></tr>`;
    }).join('')}
  </tbody></table></div>`;
}
function fuelForm(){
  openModal('Log fuel', `
    <div class="form-grid">
      <div class="field full"><label>Vehicle *</label><select id="f-vehicleId">${DB.vehicles.map(v=>`<option value="${v.id}">${v.regNo} — ${v.name}</option>`).join('')}</select></div>
      <div class="field"><label>Liters *</label><input id="f-liters" type="number" min="0"></div>
      <div class="field"><label>Cost (₹) *</label><input id="f-cost" type="number" min="0"></div>
      <div class="field full"><label>Date</label><input id="f-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveFuel()">Save log</button>`);
}
async function saveFuel(){
  const vehicleId = document.getElementById('f-vehicleId').value;
  const liters = Number(document.getElementById('f-liters').value);
  const cost = Number(document.getElementById('f-cost').value);
  if(!vehicleId||!liters||!cost){ toast('Please complete all fields', 'error'); return; }
  try{
    const log = await apiPost('/fuel', { vehicleId, liters, cost, date: document.getElementById('f-date').value });
    DB.fuelLogs.push(log);
    toast('Fuel log recorded'); closeModal(); renderFuel();
  }catch(e){ toast(e.message, 'error'); }
}
function expenseForm(){
  openModal('Log expense', `
    <div class="form-grid">
      <div class="field full"><label>Vehicle *</label><select id="f-vehicleId">${DB.vehicles.map(v=>`<option value="${v.id}">${v.regNo} — ${v.name}</option>`).join('')}</select></div>
      <div class="field"><label>Type *</label><select id="f-type"><option>Toll</option><option>Parking</option><option>Fine</option><option>Other</option></select></div>
      <div class="field"><label>Amount (₹) *</label><input id="f-amount" type="number" min="0"></div>
      <div class="field full"><label>Note</label><input id="f-note"></div>
      <div class="field full"><label>Date</label><input id="f-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveExpense()">Save expense</button>`);
}
async function saveExpense(){
  const vehicleId = document.getElementById('f-vehicleId').value;
  const amount = Number(document.getElementById('f-amount').value);
  if(!vehicleId||!amount){ toast('Please complete all fields', 'error'); return; }
  try{
    const expense = await apiPost('/fuel/expenses', {
      vehicleId, type: document.getElementById('f-type').value, amount,
      note: document.getElementById('f-note').value.trim(), date: document.getElementById('f-date').value,
    });
    DB.expenses.push(expense);
    toast('Expense recorded'); closeModal(); renderFuel();
  }catch(e){ toast(e.message, 'error'); }
}

/* ============================================================
   REPORTS & ANALYTICS
   ============================================================ */
async function renderReports(){
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="exportReportCSV()">${ICONS.csv} Export CSV</button>`;

  let report;
  try{ report = await apiGet('/reports'); }
  catch(e){ document.getElementById('tab-body').innerHTML = errorPanel(e); return; }

  const data = report.perVehicle;
  const maxEff = Math.max(1, ...data.map(d=>d.fuelEfficiency));
  const effBars = data.filter(d=>d.totalFuel>0).map(d=>`
    <div class="bar-col"><div class="bar-val">${d.fuelEfficiency.toFixed(1)}</div><div class="bar" style="height:${(d.fuelEfficiency/maxEff*100)||2}%"></div><div class="bar-label">${d.regNo}</div></div>`).join('');

  const statusColors = {Available:'var(--go)','On Trip':'var(--accent)','In Shop':'var(--warn)',Retired:'var(--danger)'};
  const total = Object.values(report.statusMix).reduce((a,b)=>a+b,0) || 1;
  let acc = 0;
  const gradientParts = Object.entries(report.statusMix).map(([k,v])=>{
    const start = acc/total*360; acc+=v; const end = acc/total*360;
    return `${statusColors[k]||'var(--text-faint)'} ${start}deg ${end}deg`;
  }).join(', ');

  document.getElementById('tab-body').innerHTML = `
    <div class="kpi-grid">
      ${kpi('Fleet Utilization', report.utilization+'%', 'on-trip / active','go')}
      ${kpi('Total Fuel Cost', fmtMoney(report.totalFuelCost), 'all vehicles')}
      ${kpi('Total Maintenance Cost', fmtMoney(report.totalMaintenanceCost), 'all vehicles','warn')}
      ${kpi('Total Operational Cost', fmtMoney(report.totalOperationalCost), 'fuel + maintenance')}
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Fuel efficiency</h3><span class="hint">km per liter, by vehicle</span></div>
        ${effBars ? `<div class="bar-chart">${effBars}</div>` : emptyState('No fuel data yet')}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Fleet status mix</h3><span class="hint">${total} vehicles</span></div>
        <div class="donut-wrap">
          <svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--line)" stroke-width="18"/>
          <foreignObject x="0" y="0" width="120" height="120"><div style="width:120px;height:120px;border-radius:50%;background:conic-gradient(${gradientParts});mask:radial-gradient(circle,transparent 32px, black 33px);-webkit-mask:radial-gradient(circle,transparent 32px, black 33px);"></div></foreignObject>
          </svg>
          <div class="donut-legend">${Object.entries(report.statusMix).map(([k,v])=>`<div class="li"><span class="sw" style="background:${statusColors[k]||'var(--text-faint)'}"></span>${k}: ${v}</div>`).join('')}</div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Per-vehicle analytics</h3><span class="hint">Efficiency · Utilization inputs · Cost · ROI</span></div>
      <div class="table-scroll"><table><thead><tr>
        <th>Vehicle</th><th>Fuel Efficiency</th><th>Distance</th><th>Fuel Cost</th><th>Maint. Cost</th><th>Operational Cost</th><th>Revenue</th><th>ROI</th>
      </tr></thead><tbody>
        ${data.map(d=>`<tr>
          <td class="mono">${d.regNo}</td>
          <td class="mono">${d.fuelEfficiency ? d.fuelEfficiency.toFixed(2)+' km/L' : '—'}</td>
          <td class="mono">${fmtNum(d.totalDistance)} km</td>
          <td class="mono">${fmtMoney(d.fuelCost)}</td>
          <td class="mono">${fmtMoney(d.maintCost)}</td>
          <td class="mono">${fmtMoney(d.opCost)}</td>
          <td class="mono">${fmtMoney(d.revenue)}</td>
          <td class="mono" style="color:${d.roi>=0?'var(--go)':'var(--danger)'}">${d.roi.toFixed(1)}%</td>
        </tr>`).join('')}
      </tbody></table></div>
    </div>`;
}
async function exportReportCSV(){
  try{
    const res = await fetch(API_BASE + '/reports/export', { headers: { Authorization: 'Bearer ' + authToken } });
    if(!res.ok) throw new Error('Export failed (' + res.status + ')');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'transitops_report.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported: transitops_report.csv');
  }catch(e){ toast(e.message, 'error'); }
}

/* ============================================================
   MISC
   ============================================================ */
function emptyState(msg){
  return `<div class="empty-state">${ICONS.empty}<div class="t">${msg}</div></div>`;
}

/* ---------------- INIT ---------------- */
renderLoginBoard();
tryResumeSession();

