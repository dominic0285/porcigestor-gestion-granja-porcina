/* ═══════════════════════════════════════════════
   PORCIGESTOR — app.js  (Supabase Full Integration)
════════════════════════════════════════════════ */

const state = {
  sidebarCollapsed: false,
  currentModule: 'dashboard',
  notifications: [],
  inventario: [],
  lotes: [],
  montas: [],
  vacunas: [],
  desparasitaciones: [],
  stock: {},
  movimientos: [],
  pesajes: [],
};

// ── Date Helpers ────────────────────────────────
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function formatDate(d) {
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
function daysBetween(a, b) { return Math.round((b - a) / (1000*60*60*24)); }
function parseSlash(str) {
  if (!str) return new Date();
  if (str.includes('/')) { const [dd,mm,yyyy] = str.split('/'); return new Date(`${yyyy}-${mm}-${dd}`); }
  return new Date(str);
}
function toISO(d) { return d.toISOString().split('T')[0]; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function formatRelTime(dateStr) {
  try {
    const d = new Date(dateStr); const now = new Date();
    const mins = Math.floor((now - d) / 60000);
    if (mins < 1) return 'Ahora'; if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60); if (hrs < 24) return `Hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Ayer'; if (days < 7) return `Hace ${days} días`;
    return formatDate(d);
  } catch { return dateStr || ''; }
}

// ── AUTH ─────────────────────────────────────────
function showApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  setCurrentDate();
  const email = user.email || '';
  const meta = user.user_metadata || {};
  const fullName = meta.full_name || meta.name || email.split('@')[0];
  const initials = fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const el = id => document.getElementById(id);
  if (el('sidebar-avatar')) el('sidebar-avatar').textContent = initials || '?';
  if (el('sidebar-name'))   el('sidebar-name').textContent = fullName;
  if (el('sidebar-role'))   el('sidebar-role').textContent = meta.role || 'Usuario';

  if (meta.role === 'Lector') {
    document.body.classList.add('readonly-mode');
  } else {
    document.body.classList.remove('readonly-mode');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn-text');
  const spn = document.getElementById('login-spinner');
  const err = document.getElementById('login-error');

  btn.textContent = 'Verificando...';
  spn.classList.remove('hidden');
  if (err) err.textContent = '';

  const emailIngresado = document.getElementById('username').value.trim();
  const passIngresada  = document.getElementById('password').value;

  await new Promise(r => setTimeout(r, 600));

  const usuario = buscarUsuario(emailIngresado);
  if (usuario && usuario.password === passIngresada) {
    localStorage.setItem('pg_session', 'activo');
    localStorage.setItem('pg_user', emailIngresado);
    showApp({ email: emailIngresado, user_metadata: { full_name: usuario.nombre, role: usuario.rol } });
    await loadAllData();
  } else {
    btn.textContent = 'Iniciar Sesión';
    spn.classList.add('hidden');
    if (err) err.textContent = 'Correo o contraseña incorrectos';
  }
}

// Usuarios definidos en config.js (ver config.example.js)
function buscarUsuario(email) {
  const lista = (window.PORCIGESTOR_CONFIG && window.PORCIGESTOR_CONFIG.USUARIOS) || [];
  return lista.find(u => u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

async function handleLogout() {
  localStorage.removeItem('pg_session');
  localStorage.removeItem('pg_user');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-btn-text').textContent = 'Iniciar Sesión';
  document.getElementById('login-spinner').classList.add('hidden');
  document.getElementById('login-form').reset();
}

(async () => {
  const session = localStorage.getItem('pg_session');
  const email   = localStorage.getItem('pg_user');
  if (session === 'activo' && email) {
    const usuario = buscarUsuario(email) || { nombre: 'Usuario', rol: 'Lector' };
    showApp({ email, user_metadata: { full_name: usuario.nombre, role: usuario.rol } });
    await loadAllData();
  }
})();

// ── SIDEBAR ──────────────────────────────────────
function toggleSidebar() {
  const sb      = document.getElementById('sidebar');
  const mc      = document.getElementById('main-content');
  const overlay = document.getElementById('sidebar-overlay');

  if (window.innerWidth <= 768) {
    const isOpen = sb.classList.contains('mobile-open');
    if (isOpen) {
      sb.classList.remove('mobile-open');
      overlay.classList.remove('active');
    } else {
      sb.classList.add('mobile-open');
      overlay.classList.add('active');
    }
  } else {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sb.classList.toggle('collapsed', state.sidebarCollapsed);
    mc.classList.toggle('expanded', state.sidebarCollapsed);
  }
}

function closeMobileSidebar() {
  const sb      = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sb.classList.remove('mobile-open');
  overlay.classList.remove('active');
}

// ── NAVIGATION ───────────────────────────────────
const moduleNames = { dashboard:'Dashboard General', inventario:'Inventario Biológico', reproductivo:'Gestión Reproductiva', sanitario:'Sanitario & Bioseguridad', almacen:'Almacén & Nutrición', analitica:'Analítica & ICA' };

function showModule(name, el) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`mod-${name}`).classList.add('active');
  el.classList.add('active');
  document.getElementById('breadcrumb').textContent = moduleNames[name] || name;
  state.currentModule = name;
  if (window.innerWidth <= 768) closeMobileSidebar();
  if (name === 'dashboard')   renderDashboard();
  if (name === 'reproductivo') renderMontas();
  if (name === 'sanitario')   renderSanitario();
  if (name === 'almacen')     renderAlmacen();
  if (name === 'analitica')   renderAnalitica();
}

// ── NOTIFICATIONS ────────────────────────────────
function toggleNotifications() { document.getElementById('notif-panel').classList.toggle('hidden'); }
document.addEventListener('click', e => { const w = document.querySelector('.notif-wrapper'); if (w && !w.contains(e.target)) document.getElementById('notif-panel').classList.add('hidden'); });

function generateNotifications() {
  state.notifications = [];
  Object.entries(state.stock).forEach(([k, s]) => {
    const m = dietaMeta[k]; if (!m) return;
    const days = s.diario > 0 ? Math.floor(s.actual / s.diario) : 999;
    if (s.actual <= s.minimo) state.notifications.push({ id:`stk-${k}`, type:'danger', icon:'🚨', title:`Stock crítico – ${m.label}`, desc:`Solo quedan ${s.actual} kg. Días: ${days}.`, time:'Ahora' });
    else if (days <= 5) state.notifications.push({ id:`stk-${k}`, type:'warning', icon:'⚠️', title:`Stock bajo – ${m.label}`, desc:`Quedan ${s.actual} kg para ${days} días.`, time:'Ahora' });
  });
  state.vacunas.forEach(v => { if (v._diff !== undefined && v._diff <= 7 && v._diff >= 0) state.notifications.push({ id:`vac-${v.id}`, type:'warning', icon:'💉', title:`Refuerzo – ${v.vacuna}`, desc:`Animal ${v.animal_id}: en ${v._diff} días.`, time:'Próx.' }); });
  state.montas.forEach(m => { if (m._diasRest !== undefined && m._diasRest > 0 && m._diasRest <= 7) state.notifications.push({ id:`mnt-${m.id}`, type:'warning', icon:'🐖', title:`Parto inminente – ${m.cerda_id}`, desc:`En ${m._diasRest} días.`, time:'Próx.' }); });
}

function renderNotifications() {
  const list = document.getElementById('notif-list'), badge = document.getElementById('notif-badge');
  list.innerHTML = '';
  if (!state.notifications.length) { list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:.85rem">Sin notificaciones ✅</div>'; badge.classList.add('hidden'); return; }
  badge.classList.remove('hidden'); badge.textContent = state.notifications.length;
  const tc = { danger:'notif-dot-red', warning:'notif-dot-yellow', info:'notif-dot-blue' };
  state.notifications.forEach(n => { const d = document.createElement('div'); d.className = `notif-item ${tc[n.type]||''}`; d.innerHTML = `<div class="notif-item-icon">${n.icon}</div><div class="notif-item-body"><div class="notif-item-title">${n.title}</div><div class="notif-item-desc">${n.desc}</div><div class="notif-item-time">${n.time}</div></div>`; list.appendChild(d); });
}
function clearNotifications() { state.notifications = []; renderNotifications(); }

// ══════════════════════════════════════════════════
//  SUPABASE DATA LAYER — LOAD
// ══════════════════════════════════════════════════
async function loadInventario() {
  const { data, error } = await window._supabase.from('inventario').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadInventario:', error); return; }
  state.inventario = data || [];
  renderInventario();
}

async function loadMontas() {
  const { data, error } = await window._supabase.from('montas').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadMontas:', error); return; }
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  (data || []).forEach(m => {
    if (m.parto_est) { m._diasRest = daysBetween(hoy, parseSlash(m.parto_est)); }
    else if (m.fecha_monta) { const p = addDays(parseSlash(m.fecha_monta), 114); m.parto_est = formatDate(p); m._diasRest = daysBetween(hoy, p); }
    else { m._diasRest = 999; }
  });
  state.montas = data || [];
}

async function loadVacunas() {
  const { data, error } = await window._supabase.from('vacunas').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadVacunas:', error); return; }
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  (data || []).forEach(v => { v._diff = v.proxima ? daysBetween(hoy, parseSlash(v.proxima)) : 999; });
  state.vacunas = data || [];
}

async function loadDesparasitaciones() {
  const { data, error } = await window._supabase.from('desparasitaciones').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadDespar:', error); return; }
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  (data || []).forEach(d => { d._diff = d.proxima ? daysBetween(hoy, parseSlash(d.proxima)) : 999; });
  state.desparasitaciones = data || [];
}

async function loadStock() {
  const { data, error } = await window._supabase.from('stock').select('*');
  if (error) { console.error('loadStock:', error); return; }
  state.stock = {};
  (data || []).forEach(s => { state.stock[s.tipo] = s; });
}

async function loadMovimientos() {
  const { data, error } = await window._supabase.from('movimientos').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) { console.error('loadMov:', error); return; }
  state.movimientos = data || [];
}

async function loadPesajes() {
  const { data, error } = await window._supabase.from('pesajes').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadPesajes:', error); return; }
  state.pesajes = data || [];
}

async function loadLotes() {
  const { data, error } = await window._supabase.from('lotes').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadLotes:', error); return; }
  state.lotes = data || [];
  populateLoteSelects();
}

function populateLoteSelects() {
  const selects = ['ani-lote', 'edit-ani-lote', 'filter-lote-inv'];
  selects.forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const current = sel.value;
    // Keep first option (Sin lote / Todos)
    const firstOpt = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(firstOpt.cloneNode(true));
    state.lotes.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.id} — ${l.nombre || ''}`;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
}

async function loadAllData() {
  await Promise.all([loadInventario(), loadLotes(), loadMontas(), loadVacunas(), loadDesparasitaciones(), loadStock(), loadMovimientos(), loadPesajes()]);
  generateNotifications();
  renderNotifications();
  renderDashboard();
}

// ══════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════
function setCurrentDate() {
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('es-VE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function renderDashboard() {
  const total = state.inventario.length;
  const gest = state.montas.filter(m => !m.resultado).length;
  const refs = state.vacunas.filter(v => v._diff >= 0 && v._diff <= 7).length;
  const stockT = Object.values(state.stock).reduce((s, v) => s + (parseFloat(v.actual) || 0), 0);
  const icas = state.pesajes.filter(p => p.ica > 0).map(p => parseFloat(p.ica));
  const icaP = icas.length ? (icas.reduce((a,b) => a+b, 0) / icas.length).toFixed(1) : '—';
  const alertC = state.notifications.filter(n => n.type === 'danger').length;

  setText('kpi-total-piara', total);
  setText('kpi-gestaciones', gest);
  setText('kpi-refuerzos', refs);
  setText('kpi-stock-total', stockT > 0 ? `${Number(stockT.toFixed(0)).toLocaleString()} kg` : '0 kg');
  setText('kpi-ica', icaP);
  setText('kpi-alertas', alertC);

  // KPI vacunas en población
  const totalVacunados = [...new Set(state.vacunas.map(v => v.animal_id))].length;
  const totalAnimales = state.inventario.length;
  const pctVac = totalAnimales > 0 ? Math.round((totalVacunados / totalAnimales) * 100) : 0;
  setText('kpi-vacunados', `${totalVacunados}/${totalAnimales}`);
  const pctEl = document.getElementById('kpi-vacunados-pct');
  if (pctEl) pctEl.textContent = `${pctVac}% vacunados`;

  // Donut
  const donutNum = document.getElementById('donut-center-num');
  const legend = document.getElementById('donut-legend');
  const segs = document.querySelectorAll('.donut-seg');
  if (total === 0) {
    if (donutNum) donutNum.textContent = '0';
    segs.forEach(s => s.setAttribute('stroke-dasharray', '0 377'));
    if (legend) legend.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">Sin animales</div>';
  } else {
    const counts = {}; state.inventario.forEach(a => { const e = a.estado || 'Otro'; counts[e] = (counts[e]||0)+1; });
    const colors = { 'Engorde':'#6366f1','Gestante':'#ec4899','Activo':'#10b981','Lactante':'#3b82f6' };
    const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    const circ = 2 * Math.PI * 60; let off = 0;
    if (donutNum) donutNum.textContent = total;
    entries.slice(0, segs.length).forEach(([est, cnt], i) => {
      const len = (cnt/total) * circ;
      segs[i].setAttribute('stroke-dasharray', `${len} ${circ}`);
      segs[i].setAttribute('stroke-dashoffset', `${-off}`);
      segs[i].setAttribute('stroke', colors[est] || '#64748b');
      off += len;
    });
    for (let i = entries.length; i < segs.length; i++) segs[i].setAttribute('stroke-dasharray', '0 377');
    if (legend) legend.innerHTML = entries.map(([e,c]) => `<div class="legend-item"><span class="leg-dot" style="background:${colors[e]||'#64748b'}"></span>${e} (${c})</div>`).join('');
  }

  renderPartosChart();
  renderDashAlerts();
  renderDashActivity();
}

function renderPartosChart() {
  const chart = document.getElementById('parto-chart'), labels = document.getElementById('parto-labels');
  chart.innerHTML = ''; labels.innerHTML = '';
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const data = [];
  for (let i = 0; i < 10; i++) {
    const d = addDays(hoy, i); const ds = formatDate(d);
    const cnt = state.montas.filter(m => m.parto_est && formatDate(parseSlash(m.parto_est)) === ds).length;
    data.push({ label: `${String(d.getDate()).padStart(2,'0')} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}`, val: cnt });
  }
  const mx = Math.max(...data.map(d => d.val), 1);
  data.forEach(d => {
    const it = document.createElement('div'); it.className = 'bar-item';
    it.innerHTML = `<span class="bar-val">${d.val}</span><div class="bar-fill" style="height:${(d.val/mx)*100}%"></div>`;
    chart.appendChild(it);
    const lb = document.createElement('div'); lb.className = 'bar-lbl-item'; lb.textContent = d.label; labels.appendChild(lb);
  });
}

function renderDashAlerts() {
  const c = document.getElementById('dashboard-alerts'); if (!c) return; c.innerHTML = '';
  const alerts = [];
  Object.entries(state.stock).forEach(([k,s]) => { const m = dietaMeta[k]; if (m && s.actual <= s.minimo) alerts.push({ t:'danger', i:'🚨', ti:`Stock crítico – ${m.label}`, d:`Solo quedan ${s.actual} kg.` }); });
  state.vacunas.filter(v => v._diff <= 7).forEach(v => alerts.push({ t: v._diff<0?'danger':'warning', i: v._diff<0?'🚨':'⚠️', ti:`Refuerzo ${v.vacuna}`, d:`${v.animal_id}: ${v._diff<0?'vencido':`en ${v._diff} días`}` }));
  state.montas.filter(m => m._diasRest >= 0 && m._diasRest <= 7).forEach(m => alerts.push({ t:'warning', i:'⚠️', ti:`Parto inminente – ${m.cerda_id}`, d:`Estimado: ${m.parto_est}` }));
  if (!alerts.length) { c.innerHTML = '<div class="alert-item alert-info"><span class="alert-icon">✅</span><div><strong>Sin alertas</strong><span>Todo en orden.</span></div></div>'; return; }
  alerts.slice(0,6).forEach(a => { const d = document.createElement('div'); d.className = `alert-item alert-${a.t==='danger'?'danger':'warning'}`; d.innerHTML = `<span class="alert-icon">${a.i}</span><div><strong>${a.ti}</strong><span>${a.d}</span></div>`; c.appendChild(d); });
}

function renderDashActivity() {
  const c = document.getElementById('dashboard-activity'); if (!c) return; c.innerHTML = '';
  const acts = [];
  state.inventario.slice(0,3).forEach(a => acts.push({ t: a.created_at, txt: `Animal registrado – ${a.id} (${a.raza||''}, ${a.sexo||''})` }));
  state.montas.slice(0,3).forEach(m => acts.push({ t: m.created_at, txt: `Monta – Cerda ${m.cerda_id} × ${m.verraco_id||'?'}` }));
  state.movimientos.slice(0,3).forEach(m => acts.push({ t: m.created_at, txt: `${m.tipo_movimiento==='entrada'?'Ingreso':'Egreso'} – ${m.tipo_alimento} ${m.cantidad} kg` }));
  state.vacunas.slice(0,2).forEach(v => acts.push({ t: v.created_at, txt: `Vacuna – ${v.animal_id} (${v.vacuna})` }));
  acts.sort((a,b) => new Date(b.t||0) - new Date(a.t||0));
  if (!acts.length) { c.innerHTML = '<div class="activity-item"><span class="act-time">—</span><span>Sin actividad. Registra tu primer animal.</span></div>'; return; }
  acts.slice(0,8).forEach(a => { const d = document.createElement('div'); d.className = 'activity-item'; d.innerHTML = `<span class="act-time">${formatRelTime(a.t)}</span><span>${a.txt}</span>`; c.appendChild(d); });
}

// ══════════════════════════════════════════════════
//  INVENTARIO
// ══════════════════════════════════════════════════
function renderInventario() {
  const tbody = document.getElementById('inventario-body'); tbody.innerHTML = '';
  setText('inv-total', state.inventario.length);
  setText('inv-hembras', state.inventario.filter(a => a.sexo === 'Hembra').length);
  setText('inv-machos', state.inventario.filter(a => a.sexo === 'Macho').length);
  setText('inv-lechones', state.inventario.filter(a => a.estado === 'Cría' || a.estado === 'Lechón').length);

  // Vacunas por animal
  const vacPorAnimal = {};
  state.vacunas.forEach(v => {
    if (!vacPorAnimal[v.animal_id]) vacPorAnimal[v.animal_id] = [];
    vacPorAnimal[v.animal_id].push(v.vacuna);
  });

  // Mapa lotes
  const loteMap = {};
  state.lotes.forEach(l => { loteMap[l.id] = l; });

  if (!state.inventario.length) { tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px">No hay animales registrados. Clic en "+ Nuevo Animal".</td></tr>'; return; }
  state.inventario.forEach(a => {
    const st = {'Gestante':'badge-pink','Lactante':'badge-blue','Engorde':'badge-purple','Activo':'badge-green','Padrote':'badge-yellow'}[a.estado] || 'badge-green';
    const q = {'Élite':'⭐⭐⭐⭐','Alta':'⭐⭐⭐','Estándar':'⭐⭐','Comercial':'⭐'}[a.calidad] || '';
    const fi = a.ingreso || (a.created_at ? formatDate(new Date(a.created_at)) : '—');
    const vacunasList = vacPorAnimal[a.id] || [];
    const vacCell = vacunasList.length > 0
      ? `<span class="badge badge-green" title="${vacunasList.join(', ')}">💉 ${vacunasList.length}</span>`
      : `<span class="badge badge-red">Sin vacuna</span>`;
    const loteInfo = a.lote ? `<span class="badge" style="background:rgba(99,102,241,.18);color:#818cf8;font-size:.74rem">${a.lote}</span>` : '<span style="color:var(--text-muted);font-size:.8rem">—</span>';
    const tr = document.createElement('tr');
    tr.dataset.id = a.id;
    tr.dataset.raza = (a.raza || '').toLowerCase();
    tr.dataset.estado = (a.estado || '').toLowerCase();
    tr.dataset.lote = (a.lote || '').toLowerCase();
    tr.dataset.search = `${a.id} ${a.nombre||''} ${a.raza||''} ${a.estado||''} ${a.lote||''}`.toLowerCase();
    tr.innerHTML = `<td><strong>${a.id}</strong></td><td>${a.nombre||'—'}</td><td>${a.raza||'—'}</td><td><span class="badge ${st}">${a.estado||'Activo'}</span></td><td>${loteInfo}</td><td>${a.sexo==='Hembra'?'♀':'♂'} ${a.sexo}</td><td title="${a.calidad||''}">${q}</td><td>${a.peso||0} kg</td><td>${fi}</td><td>${vacCell}</td><td style="display:flex;gap:6px">
      <button class="btn-ghost" style="padding:5px 10px;font-size:.78rem;color:var(--indigo)" onclick="openEditAnimal('${a.id}')">✏️</button>
      <button class="btn-ghost btn-delete" style="padding:5px 10px;font-size:.78rem;color:var(--red)" onclick="deleteAnimal('${a.id}')">🗑</button>
    </td>`;
    tbody.appendChild(tr);
  });
}

async function deleteAnimal(id) {
  if (!confirm(`¿Eliminar animal ${id}?`)) return;
  const { error } = await window._supabase.from('inventario').delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(`Animal ${id} eliminado`, 'success');
  await loadInventario(); renderDashboard();
}

// ── EDITAR ANIMAL ─────────────────────────────────
function openEditAnimal(id) {
  const a = state.inventario.find(x => x.id === id);
  if (!a) return;
  document.getElementById('edit-ani-id-hidden').value = a.id;
  document.getElementById('edit-ani-display-id').textContent = `${a.id}${a.nombre ? ' — ' + a.nombre : ''}`;
  document.getElementById('edit-ani-display-info').textContent = `${a.raza || '—'} · ${a.sexo || '—'} · Ingreso: ${a.ingreso || '—'}`;
  document.getElementById('edit-ani-estado').value = a.estado || 'Activo';
  document.getElementById('edit-ani-peso').value = a.peso || '';
  document.getElementById('edit-ani-calidad').value = a.calidad || 'Estándar';
  document.getElementById('edit-ani-obs').value = a.observaciones || '';
  // Populate lote select then set value
  populateLoteSelects();
  setTimeout(() => {
    const loteEl = document.getElementById('edit-ani-lote');
    if (loteEl) loteEl.value = a.lote || '';
  }, 50);
  openModal('modal-edit-animal');
}

async function saveEditAnimal() {
  const id = document.getElementById('edit-ani-id-hidden').value;
  if (!id) return;
  const estado  = document.getElementById('edit-ani-estado').value;
  const lote    = document.getElementById('edit-ani-lote').value;
  const peso    = parseFloat(document.getElementById('edit-ani-peso').value) || null;
  const calidad = document.getElementById('edit-ani-calidad').value;
  const obs     = document.getElementById('edit-ani-obs').value.trim();

  const updates = { estado, calidad };
  if (lote !== undefined) updates.lote = lote || null;
  if (peso !== null)  updates.peso = peso;
  if (obs)            updates.observaciones = obs;

  const { error } = await window._supabase.from('inventario').update(updates).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(`Animal ${id} actualizado`, 'success');
  closeAllModals();
  await loadInventario(); renderDashboard();
}

// ── LOTES ─────────────────────────────────────────
function openModalLotes() {
  openModal('modal-lotes');
  renderLotesModal();
}

function renderLotesModal() {
  const tb = document.getElementById('lotes-body'); if (!tb) return; tb.innerHTML = '';
  if (!state.lotes.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No hay lotes creados. Crea el primero arriba ↑</td></tr>';
    return;
  }
  state.lotes.forEach(l => {
    const animalesEnLote = state.inventario.filter(a => a.lote === l.id).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${l.id}</strong></td><td>${l.nombre||'—'}</td><td>${l.descripcion||'—'}</td><td>${l.fecha_creacion||'—'}</td><td><span class="badge badge-blue">${animalesEnLote} 🐖</span></td><td><button class="btn-ghost btn-delete" style="padding:4px 10px;font-size:.75rem;color:var(--red)" onclick="deleteLote('${l.id}')">🗑</button></td>`;
    tb.appendChild(tr);
  });
}

async function saveLote() {
  const id     = document.getElementById('lote-id').value.trim();
  const nombre = document.getElementById('lote-nombre').value.trim();
  const desc   = document.getElementById('lote-descripcion').value.trim();
  const fecha  = document.getElementById('lote-fecha').value;
  if (!id || !nombre) { showToast('ID y nombre del lote son requeridos', 'error'); return; }
  const { error } = await window._supabase.from('lotes').insert([{ id, nombre, descripcion: desc, fecha_creacion: fecha || null }]);
  if (error) { showToast(error.message.includes('duplicate') ? `Ya existe el lote ${id}` : error.message, 'error'); return; }
  showToast(`Lote ${id} creado`, 'success');
  document.getElementById('lote-id').value = '';
  document.getElementById('lote-nombre').value = '';
  document.getElementById('lote-descripcion').value = '';
  await loadLotes();
  renderLotesModal();
}

async function deleteLote(id) {
  if (!confirm(`¿Eliminar lote ${id}? Los animales asignados quedarán sin lote.`)) return;
  const { error } = await window._supabase.from('lotes').delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(`Lote ${id} eliminado`, 'success');
  await loadLotes();
  renderLotesModal();
}

function filterTable(input, tid) { const v = input.value.toLowerCase(); document.querySelectorAll(`#${tid} tbody tr`).forEach(r => { r.style.display = r.textContent.toLowerCase().includes(v) ? '' : 'none'; }); }
function filterTableSelect(sel, tid, ci) { const v = sel.value; document.querySelectorAll(`#${tid} tbody tr`).forEach(r => { const c = r.cells[ci]; r.style.display = (!v || (c && c.textContent.includes(v))) ? '' : 'none'; }); }

function filterInventarioCustom() {
  const searchEl = document.querySelector('#mod-inventario .filter-input');
  const razaEl   = document.getElementById('filter-raza-inv');
  const estadoEl = document.getElementById('filter-estado-inv');
  const loteEl   = document.getElementById('filter-lote-inv');
  const sv = searchEl ? searchEl.value.toLowerCase() : '';
  const rv = razaEl   ? razaEl.value.toLowerCase()   : '';
  const ev = estadoEl ? estadoEl.value.toLowerCase() : '';
  const lv = loteEl   ? loteEl.value.toLowerCase()   : '';
  document.querySelectorAll('#tbl-inventario tbody tr').forEach(r => {
    const ok =
      (!sv || (r.dataset.search || '').includes(sv)) &&
      (!rv || (r.dataset.raza  || '').includes(rv))  &&
      (!ev || (r.dataset.estado|| '').includes(ev))  &&
      (!lv || (r.dataset.lote  || '').includes(lv));
    r.style.display = ok ? '' : 'none';
  });
}

// ── GESTACION CALC ───────────────────────────────
function calcGestacion() { const i = document.getElementById('fecha-monta').value; if (!i) return; const m = new Date(i+'T00:00:00'), p = addDays(m,114), j = addDays(m,107), h = new Date(); h.setHours(0,0,0,0); const r = daysBetween(h,p), t = 114 - Math.max(r,0), pct = Math.min(Math.max(Math.round((t/114)*100),0),100); document.getElementById('fecha-parto').textContent = formatDate(p); document.getElementById('dias-restantes').textContent = r > 0 ? `${r} días` : '¡Parto inmediato!'; document.getElementById('fecha-jaula').textContent = formatDate(j); document.getElementById('gestacion-fill').style.width = `${pct}%`; document.getElementById('gestacion-pct').textContent = `${pct}%`; document.getElementById('calc-result').classList.remove('hidden'); }
function calcModalGestacion() { const i = document.getElementById('modal-fecha-monta').value; if (!i) return; const m = new Date(i+'T00:00:00'); document.getElementById('modal-fecha-parto').textContent = formatDate(addDays(m,114)); document.getElementById('modal-fecha-jaula').textContent = formatDate(addDays(m,107)); }

// ── MONTAS ───────────────────────────────────────
function renderMontas() {
  const tbody = document.getElementById('montas-body'); tbody.innerHTML = '';
  const ga = state.montas.filter(m => !m.resultado).length;
  setText('montas-gest-count', `${ga} gestaciones activas`);
  renderVerracos();

  // Mapa id→nombre+arete del inventario
  const animalMap = {};
  state.inventario.forEach(a => { animalMap[a.id] = a; });

  if (!state.montas.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px">No hay montas registradas.</td></tr>'; return; }

  // Filtrar según barra de búsqueda
  const searchVal = (document.getElementById('search-montas') ? document.getElementById('search-montas').value.toLowerCase() : '');

  state.montas.forEach(m => {
    const cerda = animalMap[m.cerda_id];
    const verraco = animalMap[m.verraco_id];
    const cerdaNombre = cerda ? (cerda.nombre || '—') : '—';
    const verrNombre = verraco ? (verraco.nombre ? `${verraco.nombre} (${m.verraco_id})` : m.verraco_id||'—') : (m.verraco_id||'—');

    const dr = m._diasRest != null ? m._diasRest : 999;
    const uc = dr <= 0 ? 'badge-pink' : dr <= 7 ? 'badge-yellow' : 'badge-blue';
    const ut = dr <= 0 ? 'Parida' : dr <= 7 ? `⚠ ${dr} días` : `${dr} días`;
    const et = dr <= 0 ? 'Parida' : dr <= 7 ? 'Inminente' : 'En gestación';
    const jt = dr <= 7 ? '⚠ Preparar' : dr <= 0 ? '✅ Lista' : 'Pendiente';

    const rowText = `${m.cerda_id} ${cerdaNombre} ${m.verraco_id} ${verrNombre} ${m.fecha_monta||''} ${m.parto_est||''}`.toLowerCase();
    if (searchVal && !rowText.includes(searchVal)) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${m.cerda_id}</strong><br><small style="color:var(--text-muted)">${cerdaNombre}</small></td><td>${verrNombre}</td><td>${m.fecha_monta||'—'}</td><td>${m.parto_est||'—'}</td><td><span class="badge ${uc}">${ut}</span></td><td><span class="badge ${et==='Parida'?'badge-green':'badge-blue'}">${et}</span></td><td>${jt}</td>`;
    tbody.appendChild(tr);
  });
}

function renderVerracos() {
  const tb = document.getElementById('verracos-body'); if (!tb) return; tb.innerHTML = '';
  const machos = state.inventario.filter(a => a.sexo === 'Macho');
  if (!machos.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">No hay verracos en el inventario.</td></tr>'; return; }
  machos.forEach(m => {
    const mc = state.montas.filter(mt => mt.verraco_id === m.id).length;
    const ul = state.montas.filter(mt => mt.verraco_id === m.id).sort((a,b) => parseSlash(b.fecha_monta) - parseSlash(a.fecha_monta))[0];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.id}</td><td>${m.nombre||'—'}</td><td>${m.raza||'—'}</td><td>${mc}</td><td>${ul ? ul.fecha_monta : '—'}</td><td><span class="badge badge-green">${m.estado||'Activo'}</span></td>`;
    tb.appendChild(tr);
  });
}

// ── SANITARIO ────────────────────────────────────
function renderSanitario() {
  setText('san-aldia', state.vacunas.filter(v => v._diff > 7).length);
  setText('san-proximos', state.vacunas.filter(v => v._diff >= 0 && v._diff <= 7).length);
  setText('san-vencidos', state.vacunas.filter(v => v._diff < 0).length);
  renderVacunas(); renderDesparasitaciones(); renderSanAlerts();
}

function renderVacunas() {
  const tb = document.getElementById('vacunas-body'); tb.innerHTML = '';
  const searchVal = (document.getElementById('search-vacunas') ? document.getElementById('search-vacunas').value.toLowerCase() : '');

  // Mapa id→nombre del inventario
  const animalMap = {};
  state.inventario.forEach(a => { animalMap[a.id] = a; });

  if (!state.vacunas.length) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:40px">Sin vacunaciones.</td></tr>'; return; }
  state.vacunas.forEach(v => {
    const e = v._diff < 0 ? 'Vencido' : v._diff <= 7 ? 'Próximo' : 'Al día';
    const c = e==='Vencido'?'badge-red':e==='Próximo'?'badge-yellow':'badge-green';
    const animal = animalMap[v.animal_id];
    const nombreAnimal = animal ? (animal.nombre ? `${animal.nombre}` : '—') : '—';

    const rowText = `${v.animal_id} ${nombreAnimal} ${v.vacuna||''} ${v.fecha||''} ${v.proxima||''}`.toLowerCase();
    if (searchVal && !rowText.includes(searchVal)) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${v.animal_id}</strong><br><small style="color:var(--text-muted)">${nombreAnimal}</small></td><td>${v.vacuna||''}</td><td>${v.dosis||'—'}</td><td>${v.fecha||'—'}</td><td>—</td><td class="${v._diff<0?'urgent':v._diff<=7?'soon':'ok'}">${v.proxima||'—'}</td><td><span class="badge ${c}">${e}</span></td><td><button class="btn-ghost btn-delete" style="padding:4px 10px;font-size:.75rem;color:var(--red)" onclick="deleteVacuna('${v.id}')">🗑</button></td>`;
    tb.appendChild(tr);
  });
}

async function deleteVacuna(id) {
  if (!confirm('¿Eliminar este registro de vacuna?')) return;
  const { error } = await window._supabase.from('vacunas').delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Vacuna eliminada', 'success');
  await loadVacunas(); renderSanitario(); renderDashboard();
}

function renderDesparasitaciones() {
  const tb = document.getElementById('desparasit-body'); if (!tb) return; tb.innerHTML = '';
  const searchVal = (document.getElementById('search-despar') ? document.getElementById('search-despar').value.toLowerCase() : '');

  if (!state.desparasitaciones.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">Sin desparasitaciones.</td></tr>'; return; }
  state.desparasitaciones.forEach(d => {
    const e = d._diff < 0 ? 'Vencido' : d._diff <= 7 ? 'Próximo' : 'Al día';
    const c = e==='Vencido'?'badge-red':e==='Próximo'?'badge-yellow':'badge-green';
    const rowText = `${d.animal_id} ${d.producto||''} ${d.via||''} ${d.fecha||''} ${d.proxima||''}`.toLowerCase();
    if (searchVal && !rowText.includes(searchVal)) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${d.animal_id}</strong></td><td>${d.producto||''}</td><td>${d.via||'—'}</td><td>${d.dosis||'—'}</td><td>${d.fecha||'—'}</td><td class="${d._diff<0?'urgent':d._diff<=7?'soon':'ok'}">${d.proxima||'—'}</td><td><span class="badge ${c}">${e}</span></td>`;
    tb.appendChild(tr);
  });
}

function renderSanAlerts() {
  const g = document.getElementById('san-alerts-grid'); if (!g) return; g.innerHTML = '';
  const all = [...state.vacunas.map(v => ({...v, _lbl:v.vacuna, _isV:true})), ...state.desparasitaciones.map(d => ({...d, _lbl:d.producto, _isV:false}))].filter(i => i._diff <= 14);
  if (!all.length) { g.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:20px">Sin alertas próximas. ✅</div>'; return; }
  all.sort((a,b) => a._diff - b._diff);
  all.forEach(i => {
    const cls = i._diff < 0 ? 'critical' : i._diff <= 7 ? '' : 'ok';
    const col = i._diff < 0 ? 'var(--red)' : i._diff <= 7 ? 'var(--yellow)' : 'var(--green)';
    const cd = document.createElement('div'); cd.className = `san-alert-card ${cls}`;
    cd.innerHTML = `<div class="san-alert-title">${i.animal_id} – ${i._lbl}</div><div class="san-alert-sub">${i._isV?'Vacuna':'Desparasitante'}</div><div class="san-alert-date" style="color:${col}">${i._diff<0?`⚠ Vencido hace ${Math.abs(i._diff)} días`:i._diff===0?'🚨 Hoy':`📅 En ${i._diff} días`}</div>`;
    g.appendChild(cd);
  });
}

function switchTab(cid, tid, btn) { document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden')); document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.getElementById(tid).classList.remove('hidden'); btn.classList.add('active'); }

function calcRefuerzo() {
  const fi = document.getElementById('vac-fecha'), di = document.getElementById('dias-refuerzo'), res = document.getElementById('fecha-refuerzo-calc');
  if (!fi || !di || !di.value) return;
  const f = fi.value ? new Date(fi.value+'T00:00:00') : new Date();
  const d = parseInt(di.value); if (isNaN(d) || d <= 0) return;
  res.textContent = formatDate(addDays(f, d));
}

// ── ALMACEN ──────────────────────────────────────
const dietaMeta = { iniciador:{label:'Iniciador',icon:'🐣',color:'#6366f1'}, crecimiento:{label:'Crecimiento',icon:'🐷',color:'#3b82f6'}, engorde:{label:'Engorde',icon:'🐖',color:'#f97316'}, gestacion:{label:'Gestación',icon:'🧬',color:'#ec4899'}, lactancia:{label:'Lactancia',icon:'🍼',color:'#10b981'} };

function renderAlmacen() {
  const grid = document.getElementById('stock-grid'); grid.innerHTML = '';
  const entries = Object.entries(state.stock);
  if (!entries.length) { grid.innerHTML = '<div style="color:var(--text-muted);padding:40px;text-align:center;grid-column:1/-1">Sin stock. Clic en "+ Registrar Ingreso".</div>'; }
  else entries.forEach(([k,s]) => {
    const m = dietaMeta[k] || {label:k,icon:'📦',color:'#64748b'};
    const cap = s.capacidad||1, dia = s.diario||1, pct = Math.round((s.actual/cap)*100), days = Math.floor(s.actual/dia);
    const cl = s.actual<=s.minimo?'badge-red':days<=5?'badge-yellow':'badge-green';
    const st = s.actual<=s.minimo?'⚠ Crítico':days<=5?'⚠ Bajo':'✅ Normal';
    const cd = document.createElement('div'); cd.className = 'stock-card';
    cd.innerHTML = `<div class="stock-card-header"><span class="stock-icon">${m.icon}</span><span class="badge ${cl} stock-badge">${st}</span></div><div class="stock-name">${m.label}</div><div><span class="stock-amount">${Number(s.actual).toLocaleString()}</span> <span class="stock-unit">kg</span></div><div class="stock-bar-wrap"><div class="stock-bar"><div class="stock-bar-fill" style="width:${pct}%;background:${m.color}"></div></div></div><div class="stock-daily">Consumo diario: ${s.diario} kg</div><div class="stock-days" style="color:${days<=3?'var(--red)':days<=7?'var(--yellow)':'var(--green)'}">Días restantes: ${days}</div>`;
    grid.appendChild(cd);
  });
  renderMovimientos();
}

function renderMovimientos() {
  const tb = document.getElementById('movimientos-body'); if (!tb) return; tb.innerHTML = '';
  if (!state.movimientos.length) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Sin movimientos.</td></tr>'; return; }
  state.movimientos.forEach(m => {
    const ent = m.tipo_movimiento === 'entrada';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.fecha||'—'}</td><td>${m.tipo_alimento||'—'}</td><td><span class="badge ${ent?'badge-green':'badge-red'}">${ent?'Ingreso':'Egreso'}</span></td><td>${ent?'+':'-'}${m.cantidad} kg</td><td>—</td>`;
    tb.appendChild(tr);
  });
}

function updateEgresoCalc() {
  const d = document.getElementById('egreso-dieta').value, kg = parseFloat(document.getElementById('egreso-kg').value)||0, p = document.getElementById('egreso-preview');
  if (!d || kg <= 0) { p.textContent = 'Seleccione dieta y cantidad.'; return; }
  const s = state.stock[d], m = dietaMeta[d]; if (!s||!m) { p.textContent = 'Sin stock para esta dieta.'; return; }
  const n = s.actual - kg, col = n <= s.minimo ? 'var(--red)' : 'var(--green)';
  p.innerHTML = `${m.icon} <strong>${m.label}</strong>: ${s.actual} kg → <span style="color:${col};font-weight:700">${n} kg</span> (−${kg} kg)`;
}

async function registrarEgreso() {
  const dieta = document.getElementById('egreso-dieta').value;
  const kg    = parseFloat(document.getElementById('egreso-kg').value) || 0;
  const fecha = document.getElementById('egreso-fecha').value;
  if (!dieta || kg <= 0) { showToast('Complete los campos', 'error'); return; }
  const s = state.stock[dieta];
  if (!s) { showToast('Sin stock para esta dieta', 'error'); return; }
  if (kg > s.actual) { showToast('Stock insuficiente', 'error'); return; }
  const { error: e1 } = await window._supabase.from('movimientos').insert([{
    tipo_alimento: dieta, tipo_movimiento: 'salida',
    cantidad: kg, fecha: fecha || toISO(new Date())
  }]);
  if (e1) { showToast('Error: ' + e1.message, 'error'); return; }
  const { error: e2 } = await window._supabase.from('stock')
    .update({ actual: s.actual - kg, updated_at: new Date().toISOString() })
    .eq('tipo', dieta);
  if (e2) { showToast('Error stock: ' + e2.message, 'error'); return; }
  showToast(`Egreso ${kg} kg de ${dietaMeta[dieta]?.label || dieta}`, 'success');
  document.getElementById('egreso-dieta').value = '';
  document.getElementById('egreso-kg').value = '';
  document.getElementById('egreso-preview').textContent = '';
  await loadStock(); await loadMovimientos(); renderAlmacen(); renderDashboard();
}

// ── ANALITICA ────────────────────────────────────
function renderAnalitica() {
  const icas = state.pesajes.filter(p => p.ica > 0).map(p => parseFloat(p.ica));
  setText('ana-ica', icas.length ? (icas.reduce((a,b)=>a+b,0)/icas.length).toFixed(1) : '—');
  setText('ana-eficientes', state.pesajes.filter(p => p.ica > 0 && p.ica < 3).length);
  setText('ana-bajos', state.pesajes.filter(p => p.ica >= 3.5).length);
  setText('ana-ganancia', state.pesajes.length ? ((state.pesajes.reduce((s,p) => s + (parseFloat(p.peso)||0), 0) / state.pesajes.length)).toFixed(0) + ' g' : '— g');
  renderICAChart(); renderPesajes();
}

function renderICAChart() {
  const c = document.getElementById('ica-bar-chart'); c.innerHTML = '';
  if (!state.pesajes.length) { c.innerHTML = '<div style="color:var(--text-muted);padding:40px;text-align:center">Sin pesajes.</div>'; return; }
  const grp = {}; state.pesajes.forEach(p => { const k = p.animal_id||'?'; if (!grp[k]) grp[k] = { tot:0, n:0, ica:0 }; grp[k].tot += parseFloat(p.peso)||0; grp[k].n++; grp[k].ica = parseFloat(p.ica)||0; });
  const ent = Object.entries(grp).slice(0,10); const mx = Math.max(...ent.map(([,d]) => d.tot/d.n), 1);
  ent.forEach(([id,d]) => { const avg = (d.tot/d.n).toFixed(1); const pct = (avg/mx)*100; const col = d.ica<3?'#10b981':d.ica<3.5?'#f59e0b':'#ef4444'; const it = document.createElement('div'); it.className = 'ica-bar-item'; it.innerHTML = `<span class="ica-val">${avg} kg</span><div class="ica-bar-fill" style="height:${pct}%;background:linear-gradient(180deg,${col}CC,${col}66)"></div><span class="ica-lbl">${id}</span>`; c.appendChild(it); });
}

function renderPesajes() {
  const tb = document.getElementById('pesaje-body'); tb.innerHTML = '';
  if (!state.pesajes.length) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:40px">Sin pesajes registrados.</td></tr>'; return; }
  state.pesajes.forEach(p => {
    const ica = parseFloat(p.ica)||0; const e = ica<3?'Eficiente':ica<3.5?'Normal':'Bajo';
    const sc = e==='Eficiente'?'badge-green':e==='Normal'?'badge-blue':'badge-red';
    const ic = ica<3?'var(--green)':ica<3.5?'var(--yellow)':'var(--red)';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${p.animal_id||'—'}</strong></td><td>—</td><td>—</td><td>${p.peso||0} kg</td><td>—</td><td>${p.alimento||0} kg</td><td style="font-weight:800;color:${ic}">${ica}</td><td><span class="badge ${sc}">${e}</span></td>`;
    tb.appendChild(tr);
  });
}

// ══════════════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════════════
function openModal(id) { document.getElementById('modal-overlay').classList.remove('hidden'); document.getElementById(id).classList.remove('hidden'); }
function closeAllModals() { document.getElementById('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

// ══════════════════════════════════════════════════
//  SAVE FUNCTIONS — REAL SUPABASE
// ══════════════════════════════════════════════════
async function saveAnimal() {
  const id = document.getElementById('ani-id').value.trim();
  if (!id) { showToast('ID de arete requerido', 'error'); return; }
  const loteVal = document.getElementById('ani-lote') ? document.getElementById('ani-lote').value : '';
  const { error } = await window._supabase.from('inventario').insert([{
    id,
    nombre:  document.getElementById('ani-nombre').value.trim(),
    raza:    document.getElementById('ani-raza').value,
    sexo:    document.getElementById('ani-sexo').value,
    peso:    parseFloat(document.getElementById('ani-peso').value) || 0,
    ingreso: document.getElementById('ani-ingreso').value,
    estado:  document.getElementById('ani-estado').value,
    calidad: document.getElementById('ani-calidad').value,
    lote:    loteVal || null
  }]);
  if (error) { showToast(error.message.includes('duplicate') ? `Ya existe ${id}` : error.message, 'error'); return; }
  showToast(`Animal ${id} registrado`, 'success'); closeAllModals();
  await loadInventario(); renderDashboard();
}

async function saveMonta() {
  const cerda   = document.getElementById('mnt-cerda').value.trim();
  const verraco = document.getElementById('mnt-verraco').value;
  const fecha   = document.getElementById('modal-fecha-monta').value;
  const tipo    = document.getElementById('mnt-tipo').value;
  if (!cerda) { showToast('ID cerda requerido', 'error'); return; }
  const partoEst = fecha ? formatDate(addDays(new Date(fecha+'T00:00:00'), 114)) : null;
  const { error } = await window._supabase.from('montas').insert([{
    cerda_id: cerda, verraco_id: verraco, fecha_monta: fecha, tipo,
    parto_est: partoEst, notas: document.getElementById('mnt-notas').value
  }]);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(`Monta registrada para ${cerda}`, 'success'); closeAllModals();
  await loadMontas(); generateNotifications(); renderNotifications(); renderDashboard();
}

async function saveVacuna() {
  const animal  = document.getElementById('vac-animal').value.trim();
  const vacuna  = document.getElementById('vac-nombre').value.trim();
  const fecha   = document.getElementById('vac-fecha').value;
  if (!animal) { showToast('ID animal requerido', 'error'); return; }
  const dias    = parseInt(document.getElementById('dias-refuerzo').value) || 0;
  const proxima = (fecha && dias > 0) ? formatDate(addDays(new Date(fecha+'T00:00:00'), dias)) : null;
  const tipoReg = document.getElementById('vac-tipo').value;

  if (tipoReg === 'Desparasitante') {
    const { error } = await window._supabase.from('desparasitaciones').insert([{
      animal_id: animal, producto: vacuna, fecha,
      dosis: document.getElementById('vac-dosis').value,
      via: '—', proxima
    }]);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
  } else {
    const { error } = await window._supabase.from('vacunas').insert([{
      animal_id: animal, vacuna, fecha,
      dosis: document.getElementById('vac-dosis').value,
      aplicador: '', proxima, notas: ''
    }]);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
  }
  showToast(`Registro sanitario para ${animal}`, 'success'); closeAllModals();
  await loadVacunas(); await loadDesparasitaciones(); generateNotifications(); renderNotifications(); renderDashboard();
}

async function saveStock() {
  const tipo      = document.getElementById('stk-tipo').value.toLowerCase();
  const cantidad  = parseFloat(document.getElementById('stk-cantidad').value) || 0;
  const fecha     = document.getElementById('stk-fecha').value;
  const proveedor = document.getElementById('stk-proveedor').value;
  if (!tipo || cantidad <= 0) { showToast('Complete tipo y cantidad', 'error'); return; }
  const { error: e1 } = await window._supabase.from('movimientos').insert([{
    tipo_alimento: tipo, tipo_movimiento: 'entrada',
    cantidad, fecha: fecha || toISO(new Date()), proveedor
  }]);
  if (e1) { showToast('Error: ' + e1.message, 'error'); return; }
  const existing = state.stock[tipo];
  if (existing) {
    await window._supabase.from('stock')
      .update({ actual: existing.actual + cantidad, updated_at: new Date().toISOString() })
      .eq('tipo', tipo);
  } else {
    await window._supabase.from('stock')
      .insert([{ tipo, actual: cantidad, minimo: 100, diario: 30, capacidad: 2000 }]);
  }
  showToast(`Ingreso ${cantidad} kg de ${dietaMeta[tipo]?.label || tipo}`, 'success'); closeAllModals();
  await loadStock(); await loadMovimientos(); renderAlmacen(); renderDashboard();
}

async function savePesaje() {
  const animal   = document.getElementById('pes-animal').value.trim();
  const fecha    = document.getElementById('pes-fecha').value;
  const peso     = parseFloat(document.getElementById('pes-peso').value) || 0;
  const alimento = parseFloat(document.getElementById('pes-alimento').value) || 0;
  if (!animal) { showToast('ID animal requerido', 'error'); return; }
  const ica = alimento > 0 && peso > 0 ? (alimento / peso).toFixed(2) : 0;
  const { error } = await window._supabase.from('pesajes').insert([{
    animal_id: animal, fecha, peso, alimento, ica: parseFloat(ica)
  }]);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(`Pesaje registrado para ${animal}`, 'success'); closeAllModals();
  await loadPesajes(); renderAnalitica(); renderDashboard();
}

// ══════════════════════════════════════════════════
//  REPORTE PDF COMPLETO
// ══════════════════════════════════════════════════
function generatePDFReport() {
  const fecha = new Date().toLocaleDateString('es-VE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const animalMap = {};
  state.inventario.forEach(a => { animalMap[a.id] = a; });

  // Construir HTML del reporte
  let html = `
  <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Reporte PorciGestor – ${fecha}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:#1a1a2e; font-size:11px; }
    .cover { background: linear-gradient(135deg,#6366f1,#ec4899); color:#fff; padding:60px 40px; text-align:center; page-break-after:always; }
    .cover h1 { font-size:36px; font-weight:800; margin-bottom:10px; }
    .cover p { font-size:14px; opacity:.85; }
    .cover .fecha { margin-top:20px; font-size:13px; font-weight:600; }
    .section { padding:24px 32px; page-break-inside:avoid; }
    .section-title { font-size:16px; font-weight:700; color:#6366f1; border-bottom:2px solid #6366f1; padding-bottom:8px; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
    .kpi-row { display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
    .kpi-box { background:#f1f5f9; border-radius:8px; padding:12px 18px; flex:1; min-width:100px; text-align:center; }
    .kpi-box .val { font-size:22px; font-weight:800; color:#6366f1; }
    .kpi-box .lbl { font-size:10px; color:#64748b; margin-top:2px; }
    table { width:100%; border-collapse:collapse; margin-bottom:12px; font-size:10px; }
    th { background:#1e293b; color:#fff; padding:7px 10px; text-align:left; font-weight:600; }
    td { padding:6px 10px; border-bottom:1px solid #e2e8f0; }
    tr:nth-child(even) td { background:#f8fafc; }
    .badge { display:inline-block; padding:2px 7px; border-radius:9px; font-size:9px; font-weight:700; }
    .badge-green { background:#d1fae5; color:#065f46; }
    .badge-red { background:#fee2e2; color:#991b1b; }
    .badge-yellow { background:#fef3c7; color:#92400e; }
    .badge-blue { background:#dbeafe; color:#1e40af; }
    .badge-pink { background:#fce7f3; color:#9d174d; }
    .no-data { color:#94a3b8; font-style:italic; text-align:center; padding:16px; }
    .page-break { page-break-before:always; }
    .footer { text-align:center; color:#94a3b8; font-size:9px; padding:16px; border-top:1px solid #e2e8f0; margin-top:auto; }
  </style></head><body>

  <!-- PORTADA -->
  <div class="cover">
    <div style="font-size:60px;margin-bottom:16px">🐷</div>
    <h1>PorciGestor</h1>
    <p>Sistema de Gestión Porcina Inteligente</p>
    <div style="margin:24px 0; display:flex; gap:24px; justify-content:center; flex-wrap:wrap;">
      <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:14px 24px;">
        <div style="font-size:28px;font-weight:800">${state.inventario.length}</div>
        <div style="font-size:11px;opacity:.8">Animales</div>
      </div>
      <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:14px 24px;">
        <div style="font-size:28px;font-weight:800">${state.montas.filter(m=>!m.resultado).length}</div>
        <div style="font-size:11px;opacity:.8">Gestaciones</div>
      </div>
      <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:14px 24px;">
        <div style="font-size:28px;font-weight:800">${state.vacunas.length}</div>
        <div style="font-size:11px;opacity:.8">Vacunaciones</div>
      </div>
    </div>
    <div class="fecha">Generado: ${fecha}</div>
  </div>

  <!-- 1. INVENTARIO -->
  <div class="section page-break">
    <div class="section-title">🐖 Inventario Biológico y Genético</div>
    <div class="kpi-row">
      <div class="kpi-box"><div class="val">${state.inventario.length}</div><div class="lbl">Total</div></div>
      <div class="kpi-box"><div class="val">${state.inventario.filter(a=>a.sexo==='Hembra').length}</div><div class="lbl">♀ Hembras</div></div>
      <div class="kpi-box"><div class="val">${state.inventario.filter(a=>a.sexo==='Macho').length}</div><div class="lbl">♂ Machos</div></div>
      <div class="kpi-box"><div class="val">${state.inventario.filter(a=>a.estado==='Gestante').length}</div><div class="lbl">Gestantes</div></div>
      <div class="kpi-box"><div class="val">${state.inventario.filter(a=>a.estado==='Lactante').length}</div><div class="lbl">Lactantes</div></div>
    </div>
  `;

  if (state.inventario.length) {
    // Vacunas por animal
    const vacPorAnimal = {};
    state.vacunas.forEach(v => {
      if (!vacPorAnimal[v.animal_id]) vacPorAnimal[v.animal_id] = [];
      vacPorAnimal[v.animal_id].push(v.vacuna);
    });
    html += `
    <table><thead><tr>
      <th>ID Arete</th><th>Nombre</th><th>Raza</th><th>Sexo</th><th>Estado</th><th>Lote</th>
      <th>Peso (kg)</th><th>Calidad</th><th>F. Ingreso</th><th>Vacunas</th>
    </tr></thead><tbody>`;
    state.inventario.forEach(a => {
      const fi = a.ingreso || (a.created_at ? formatDate(new Date(a.created_at)) : '—');
      const vacs = vacPorAnimal[a.id] ? vacPorAnimal[a.id].join(', ') : '—';
      const stCls = {'Gestante':'badge-pink','Lactante':'badge-blue','Engorde':'badge-yellow','Activo':'badge-green','Padrote':'badge-yellow'}[a.estado]||'badge-green';
      html += `<tr><td><strong>${a.id}</strong></td><td>${a.nombre||'—'}</td><td>${a.raza||'—'}</td><td>${a.sexo||'—'}</td>
        <td><span class="badge ${stCls}">${a.estado||'Activo'}</span></td>
        <td>${a.lote||'—'}</td>
        <td>${a.peso||0}</td><td>${a.calidad||'—'}</td><td>${fi}</td><td>${vacs}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<div class="no-data">Sin animales registrados.</div>`;
  }
  html += `</div>`;

  // 2. REPRODUCTIVO
  html += `<div class="section page-break">
    <div class="section-title">🧬 Gestión Reproductiva</div>
    <div class="kpi-row">
      <div class="kpi-box"><div class="val">${state.montas.length}</div><div class="lbl">Total Montas</div></div>
      <div class="kpi-box"><div class="val">${state.montas.filter(m=>!m.resultado).length}</div><div class="lbl">En Gestación</div></div>
      <div class="kpi-box"><div class="val">${state.montas.filter(m=>m._diasRest>=0&&m._diasRest<=7).length}</div><div class="lbl">Partos Inminentes</div></div>
      <div class="kpi-box"><div class="val">${state.inventario.filter(a=>a.sexo==='Macho').length}</div><div class="lbl">Verracos</div></div>
    </div>
    <h4 style="margin-bottom:8px;color:#475569">Montas Registradas</h4>
  `;
  if (state.montas.length) {
    html += `<table><thead><tr>
      <th>ID Cerda</th><th>Nombre Cerda</th><th>Verraco (Arete)</th><th>Nombre Verraco</th>
      <th>Fecha Monta</th><th>Parto Estimado</th><th>Días Rest.</th><th>Estado</th>
    </tr></thead><tbody>`;
    state.montas.forEach(m => {
      const cerda = animalMap[m.cerda_id];
      const verr = animalMap[m.verraco_id];
      const dr = m._diasRest != null ? m._diasRest : 999;
      const et = dr<=0?'Parida':dr<=7?'Inminente':'En gestación';
      const etCls = dr<=0?'badge-green':dr<=7?'badge-yellow':'badge-blue';
      html += `<tr>
        <td><strong>${m.cerda_id}</strong></td>
        <td>${cerda?cerda.nombre||'—':'—'}</td>
        <td>${m.verraco_id||'—'}</td>
        <td>${verr?verr.nombre||'—':'—'}</td>
        <td>${m.fecha_monta||'—'}</td>
        <td>${m.parto_est||'—'}</td>
        <td>${dr===999?'—':dr}</td>
        <td><span class="badge ${etCls}">${et}</span></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<div class="no-data">Sin montas registradas.</div>`;
  }
  html += `</div>`;

  // 3. SANITARIO
  html += `<div class="section page-break">
    <div class="section-title">💉 Sanitario & Bioseguridad</div>
    <div class="kpi-row">
      <div class="kpi-box"><div class="val">${state.vacunas.filter(v=>v._diff>7).length}</div><div class="lbl">✅ Al día</div></div>
      <div class="kpi-box"><div class="val">${state.vacunas.filter(v=>v._diff>=0&&v._diff<=7).length}</div><div class="lbl">⚠ Próximos 7d</div></div>
      <div class="kpi-box"><div class="val">${state.vacunas.filter(v=>v._diff<0).length}</div><div class="lbl">🚨 Vencidos</div></div>
      <div class="kpi-box"><div class="val">${state.desparasitaciones.length}</div><div class="lbl">Desparasitaciones</div></div>
    </div>
    <h4 style="margin-bottom:8px;color:#475569">Vacunaciones</h4>
  `;
  if (state.vacunas.length) {
    html += `<table><thead><tr>
      <th>ID Animal</th><th>Nombre</th><th>Vacuna</th><th>Dosis</th>
      <th>F. Aplicación</th><th>Próx. Refuerzo</th><th>Estado</th>
    </tr></thead><tbody>`;
    state.vacunas.forEach(v => {
      const e = v._diff<0?'Vencido':v._diff<=7?'Próximo':'Al día';
      const c = e==='Vencido'?'badge-red':e==='Próximo'?'badge-yellow':'badge-green';
      const animal = animalMap[v.animal_id];
      html += `<tr>
        <td><strong>${v.animal_id}</strong></td>
        <td>${animal?animal.nombre||'—':'—'}</td>
        <td>${v.vacuna||'—'}</td><td>${v.dosis||'—'}</td>
        <td>${v.fecha||'—'}</td><td>${v.proxima||'—'}</td>
        <td><span class="badge ${c}">${e}</span></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<div class="no-data">Sin vacunaciones.</div>`;
  }

  html += `<h4 style="margin:16px 0 8px;color:#475569">Desparasitaciones</h4>`;
  if (state.desparasitaciones.length) {
    html += `<table><thead><tr>
      <th>ID Animal / Lote</th><th>Producto</th><th>Vía</th><th>Dosis</th>
      <th>Fecha</th><th>Próx. Aplicación</th><th>Estado</th>
    </tr></thead><tbody>`;
    state.desparasitaciones.forEach(d => {
      const e = d._diff<0?'Vencido':d._diff<=7?'Próximo':'Al día';
      const c = e==='Vencido'?'badge-red':e==='Próximo'?'badge-yellow':'badge-green';
      html += `<tr><td>${d.animal_id}</td><td>${d.producto||'—'}</td><td>${d.via||'—'}</td><td>${d.dosis||'—'}</td>
        <td>${d.fecha||'—'}</td><td>${d.proxima||'—'}</td><td><span class="badge ${c}">${e}</span></td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<div class="no-data">Sin desparasitaciones.</div>`;
  }
  html += `</div>`;

  // 4. ALMACEN
  html += `<div class="section page-break">
    <div class="section-title">🌾 Almacén & Nutrición</div>
    <div class="kpi-row">`;
  Object.entries(state.stock).forEach(([k,s]) => {
    const m = dietaMeta[k]||{label:k,icon:'📦'};
    const days = s.diario > 0 ? Math.floor(s.actual/s.diario) : '—';
    const cl = s.actual<=s.minimo?'badge-red':days<=5?'badge-yellow':'badge-green';
    html += `<div class="kpi-box"><div class="val" style="font-size:16px">${s.actual} kg</div><div class="lbl">${m.icon} ${m.label}</div><div><span class="badge ${cl}">${days} días</span></div></div>`;
  });
  html += `</div>
    <h4 style="margin-bottom:8px;color:#475569">Últimos 20 Movimientos</h4>
    <table><thead><tr><th>Fecha</th><th>Dieta</th><th>Tipo</th><th>Cantidad</th></tr></thead><tbody>`;
  if (state.movimientos.length) {
    state.movimientos.forEach(m => {
      const ent = m.tipo_movimiento==='entrada';
      html += `<tr><td>${m.fecha||'—'}</td><td>${m.tipo_alimento||'—'}</td>
        <td><span class="badge ${ent?'badge-green':'badge-red'}">${ent?'Ingreso':'Egreso'}</span></td>
        <td>${ent?'+':'-'}${m.cantidad} kg</td></tr>`;
    });
  } else {
    html += `<tr><td colspan="4" class="no-data">Sin movimientos.</td></tr>`;
  }
  html += `</tbody></table></div>`;

  // Footer
  html += `
  <div class="footer">
    PorciGestor — Reporte generado el ${fecha} · Sistema de Gestión Porcina Inteligente
  </div>
  </body></html>`;

  // Abrir ventana de impresión
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 800);
}

// ── TOAST ────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  const toast = document.getElementById('toast');
  toast.className = `toast ${type}`; toast.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ── INIT ─────────────────────────────────────────
function init() {
  renderNotifications();
  renderInventario();
  renderDashboard();
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(i => { if (!i.value) i.value = today; });
}
init();
