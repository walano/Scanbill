// ── Config ──
// Mets ton URL de déploiement ici — ex: 'https://scanbill.vercel.app'
var SITE_URL = 'https://scanbill-ivory.vercel.app';

// ── Supabase config ──
var SUPABASE_URL = 'https://xudwrqowcnqsggiizmhw.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZHdycW93Y25xc2dnaWl6bWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTcyNjUsImV4cCI6MjA5NzEzMzI2NX0.qFJKOM4PAJHrjPqTHNwmwKW6ks1rgwH40LF1RyXrRE0';


var CURRENCIES = [
  ['XAF','FCFA — CFA Afrique Centrale'],['XOF','FCFA — CFA Afrique de l\'Ouest'],
  ['GHS','GHS — Cedi ghanéen'],['NGN','NGN — Naira nigérian'],
  ['KES','KES — Shilling kenyan'],['ZAR','ZAR — Rand sud-africain'],
  ['EGP','EGP — Livre égyptienne'],['ETB','ETB — Birr éthiopien'],
  ['MAD','MAD — Dirham marocain'],['TZS','TZS — Shilling tanzanien'],
  ['UGX','UGX — Shilling ougandais'],['GNF','GNF — Franc guinéen'],
  ['RWF','RWF — Franc rwandais'],['MZN','MZN — Metical mozambicain'],
  ['AOA','AOA — Kwanza angolais'],['ZMW','ZMW — Kwacha zambien'],
  ['CDF','CDF — Franc congolais'],['DZD','DZD — Dinar algérien'],
  ['TND','TND — Dinar tunisien'],['LYD','LYD — Dinar libyen'],
  ['USD','USD — Dollar américain'],['EUR','EUR — Euro'],
  ['GBP','GBP — Livre sterling'],['JPY','JPY — Yen japonais'],
  ['CNY','CNY — Yuan chinois'],['CHF','CHF — Franc suisse'],
  ['CAD','CAD — Dollar canadien'],['AUD','AUD — Dollar australien'],
  ['NZD','NZD — Dollar néo-zélandais'],['SGD','SGD — Dollar singapourien'],
  ['HKD','HKD — Dollar de Hong Kong'],['KRW','KRW — Won sud-coréen'],
  ['INR','INR — Roupie indienne'],['BRL','BRL — Réal brésilien'],
  ['MXN','MXN — Peso mexicain'],['ARS','ARS — Peso argentin'],
  ['CLP','CLP — Peso chilien'],['COP','COP — Peso colombien'],
  ['PEN','PEN — Sol péruvien'],['UYU','UYU — Peso uruguayen'],
  ['SAR','SAR — Riyal saoudien'],['AED','AED — Dirham des Émirats'],
  ['QAR','QAR — Riyal qatarien'],['KWD','KWD — Dinar koweïtien'],
  ['BHD','BHD — Dinar bahreïni'],['OMR','OMR — Rial omanais'],
  ['ILS','ILS — Shekel israélien'],['TRY','TRY — Livre turque'],
  ['RUB','RUB — Rouble russe'],['PKR','PKR — Roupie pakistanaise'],
  ['BDT','BDT — Taka bangladais'],['LKR','LKR — Roupie sri-lankaise'],
  ['THB','THB — Baht thaïlandais'],['VND','VND — Dong vietnamien'],
  ['IDR','IDR — Roupiah indonésienne'],['PHP','PHP — Peso philippin'],
  ['MYR','MYR — Ringgit malaisien'],['TWD','TWD — Dollar taïwanais'],
  ['KZT','KZT — Tenge kazakh'],['UAH','UAH — Hryvnia ukrainienne'],
  ['GEL','GEL — Lari géorgien'],['SEK','SEK — Couronne suédoise'],
  ['NOK','NOK — Couronne norvégienne'],['DKK','DKK — Couronne danoise'],
  ['PLN','PLN — Zloty polonais'],['HUF','HUF — Forint hongrois'],
  ['CZK','CZK — Couronne tchèque'],['RON','RON — Leu roumain'],
  ['BGN','BGN — Lev bulgare'],['BTC','BTC — Bitcoin'],
  ['ETH','ETH — Ethereum'],['USDT','USDT — Tether']
];

// ── State ──
var currentRole = null;
var currentUserEmail = null;
var tickets = {};
var scanLog = [];
var concertMeta = {};
var camStream = null;
var camInterval = null;
var sb = null; // Supabase client

// ── Supabase init ──
function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  if (window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }
  return false;
}

// ── DB helpers ──
async function dbSaveMeta(meta) {
  if (!sb) return;
  await sb.from('concert_meta').upsert({ id: 1, ...meta });
}

async function dbLoadMeta() {
  if (!sb) return null;
  var res = await sb.from('concert_meta').select('*').eq('id', 1).single();
  return res.data || null;
}

async function dbInsertTickets(newTickets) {
  if (!sb) return;
  var rows = newTickets.map(function(t) {
    return {
      id: t.id, concert: t.concert, presale: t.presale, door: t.door,
      currency: t.currency, concert_date: t.concertDate, concert_time: t.concertTime,
      used: false, status: 'available', scan_time: null, sold_time: null, entry_time: null, scanned_price: null, scanned_mode: null
    };
  });
  await sb.from('tickets').insert(rows);
}

async function dbLoadTickets() {
  if (!sb) return null;
  var res = await sb.from('tickets').select('*').order('id');
  if (res.error) return null;
  var map = {};
  res.data.forEach(function(r) {
    map[r.id] = {
      id: r.id, concert: r.concert, presale: r.presale, door: r.door,
      currency: r.currency, concertDate: r.concert_date, concertTime: r.concert_time,
      used: r.used, status: r.status || 'available',
      scanTime: r.scan_time, soldTime: r.sold_time, entryTime: r.entry_time,
      scannedPrice: r.scanned_price, scannedMode: r.scanned_mode,
      soldBy: r.sold_by, enteredBy: r.entered_by
    };
  });
  return map;
}

async function dbMarkSold(id, soldTime, scannedPrice, scannedMode, soldBy) {
  if (!sb) return;
  await sb.from('tickets').update({
    status: 'sold', sold_time: soldTime, scan_time: soldTime,
    scanned_price: scannedPrice, scanned_mode: scannedMode, sold_by: soldBy
  }).eq('id', id);
}

async function dbMarkEntered(id, entryTime, enteredBy) {
  if (!sb) return;
  await sb.from('tickets').update({
    status: 'entered', used: true, entry_time: entryTime, scan_time: entryTime, entered_by: enteredBy
  }).eq('id', id);
}

async function dbClearAll() {
  if (!sb) return;
  await sb.from('tickets').delete().neq('id', '');
  await sb.from('concert_meta').delete().eq('id', 1);
}

// ── Init ──
(function init() {
  // Populate currency dropdown
  var sel = document.getElementById('currency');
  CURRENCIES.forEach(function(c) {
    var o = document.createElement('option');
    o.value = c[0]; o.textContent = c[1];
    if (c[0] === 'XAF') o.selected = true;
    sel.appendChild(o);
  });

  // Price preview listeners
  ['price-presale','price-door','concert-date','concert-time','currency'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', updatePricePreview);
    document.getElementById(id).addEventListener('input', updatePricePreview);
  });
  updatePricePreview();

  // Load Supabase async, then check for existing session
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload = function() {
      if (!initSupabase()) return;
      // Auto-login if session exists
      sb.auth.getSession().then(function(res) {
        if (res.data && res.data.session) {
          var meta = res.data.session.user.user_metadata || {};
          currentRole = meta.role || 'agent';
          currentUserEmail = res.data.session.user.email || null;
          document.getElementById('app-login').style.display = 'none';
          document.getElementById('app-shell').style.display = 'flex';
          loadAll().then(function() { setupShell(); });
        }
      });
    };
    s.onerror = function() {
      document.getElementById('pin-err').textContent = 'Erreur de chargement. Vérifiez votre connexion.';
    };
    document.head.appendChild(s);
  }
})();

// ── Price logic ──
function getActivePrice(meta) {
  if (!meta || !meta.concertDate) return { price: meta.presale, mode: 'prévente' };
  var now = new Date();
  var switchDT = new Date(meta.concertDate + 'T' + (meta.concertTime || '00:00') + ':00');
  return now >= switchDT
    ? { price: meta.door, mode: 'jour J' }
    : { price: meta.presale, mode: 'prévente' };
}

function updatePricePreview() {
  var presale = parseInt(document.getElementById('price-presale').value) || 0;
  var door = parseInt(document.getElementById('price-door').value) || 0;
  var date = document.getElementById('concert-date').value;
  var time = document.getElementById('concert-time').value || '00:00';
  var currency = document.getElementById('currency').value;
  var meta = { presale: presale, door: door, concertDate: date, concertTime: time };
  var active = getActivePrice(meta);
  var el = document.getElementById('price-preview');
  if (date) {
    var dt = new Date(date + 'T' + time + ':00');
    var fmt = dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' à ' + time;
    el.textContent = 'Tarif actif: ' + active.price.toLocaleString() + ' ' + currency + ' (' + active.mode + ')  —  bascule le ' + fmt;
  } else {
    el.textContent = 'Tarif actif: ' + active.price.toLocaleString() + ' ' + currency + ' (' + active.mode + ')';
  }
}

// ── Auth ──
async function tryLogin() {
  var email = document.getElementById('email-input').value.trim().toLowerCase();
  var pin = document.getElementById('pin-input').value.trim();
  var err = document.getElementById('pin-err');
  if (!email || !pin) { err.textContent = 'Email et mot de passe requis.'; return; }

  err.textContent = '';
  document.getElementById('login-btn').disabled = true;
  document.getElementById('login-btn').textContent = 'Connexion...';

  // Wait for Supabase to finish loading if needed (max 6s)
  if (!sb) {
    var waited = 0;
    await new Promise(function(resolve) {
      var check = setInterval(function() {
        waited += 200;
        if (sb || waited >= 6000) { clearInterval(check); resolve(); }
      }, 200);
    });
  }

  if (!sb) {
    err.textContent = 'Connexion impossible. Vérifiez votre connexion internet.';
    document.getElementById('login-btn').disabled = false;
    document.getElementById('login-btn').textContent = 'Entrer';
    return;
  }

  var res = await sb.auth.signInWithPassword({ email: email, password: pin });

  if (res.error) {
    err.textContent = 'Identifiants incorrects.';
    document.getElementById('pin-input').value = '';
    document.getElementById('login-btn').disabled = false;
    document.getElementById('login-btn').textContent = 'Entrer';
    return;
  }

  // Read role from JWT user_metadata
  var meta = res.data.user.user_metadata || {};
  currentRole = meta.role || 'agent';
  currentUserEmail = res.data.user.email || email;

  document.getElementById('app-login').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  document.getElementById('login-btn').disabled = false;
  document.getElementById('login-btn').textContent = 'Entrer';
  loadAll().then(function() { setupShell(); });
}

// Friendly agent label from email (e.g. "agent1@scanbill.app" → "agent1")
function agentLabel(email) {
  return email ? String(email).split('@')[0] : '';
}

async function logout() {
  stopCamera();
  if (sb) await sb.auth.signOut();
  currentRole = null;
  currentUserEmail = null;
  tickets = {}; scanLog = []; concertMeta = {};
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('app-login').style.display = 'flex';
  document.getElementById('pin-input').value = '';
  document.getElementById('email-input').value = '';
  document.getElementById('pin-err').textContent = '';
  document.getElementById('ticket-grid').innerHTML = '';
  if (document.getElementById('ticket-detail')) document.getElementById('ticket-detail').style.display = 'none';
  if (document.getElementById('scan-result')) document.getElementById('scan-result').style.display = 'none';
}

// ── Storage — Supabase only ──

async function loadAll() {
  if (!sb) return;
  var meta = await dbLoadMeta();
  if (meta) {
    concertMeta = {
      name: meta.name, presale: meta.presale, door: meta.door,
      currency: meta.currency, concertDate: meta.concert_date,
      concertTime: meta.concert_time, siteUrl: meta.site_url || SITE_URL
    };
  }
  var tix = await dbLoadTickets();
  if (tix) tickets = tix;
  updateStats();
}

async function saveAll() {
  if (!sb) return;
  await dbSaveMeta({
    name: concertMeta.name, presale: concertMeta.presale, door: concertMeta.door,
    currency: concertMeta.currency, concert_date: concertMeta.concertDate,
    concert_time: concertMeta.concertTime, site_url: concertMeta.siteUrl || SITE_URL
  });
}

// ── Shell setup ──
var NAV_ICONS = {
  generate: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>',
  registry: '<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  stats: '<svg viewBox="0 0 24 24"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>'
};

function tabBtn(name, label, active) {
  return '<button class="tab-link' + (active ? ' active' : '') + '" onclick="switchTab(\'' + name + '\',this)">' + label + '</button>';
}
function bnavBtn(name, label, active) {
  return '<button class="bottom-nav-btn' + (active ? ' active' : '') + '" id="bnav-' + name + '" onclick="switchTabMobile(\'' + name + '\')">' + NAV_ICONS[name] + '<span>' + label + '</span></button>';
}

function setupShell() {
  var tag = document.getElementById('role-tag');
  var nav = document.getElementById('tab-nav');
  var bnav = document.getElementById('bottom-nav');
  tag.textContent = currentRole === 'admin' ? 'Organisateur' : 'Agent scan';

  var statsRow = document.getElementById('stats-row');

  if (currentRole === 'admin') {
    // Stats header lives in the Registre tab for the organiser
    var regSlot = document.querySelector('#panel-registry .table-wrap');
    if (statsRow && regSlot) document.getElementById('panel-registry').insertBefore(statsRow, regSlot);

    nav.innerHTML = tabBtn('generate', 'Générer', true) + tabBtn('scan', 'Scanner') + tabBtn('registry', 'Registre');
    bnav.innerHTML = bnavBtn('generate', 'Générer', true) + bnavBtn('scan', 'Scanner') + bnavBtn('registry', 'Registre');
    fillGenerateForm();
    rebuildGrid();
    switchTab('generate', nav.children[0]);
  } else {
    // Agent: stats header lives in its own Statistiques tab
    if (statsRow) document.getElementById('stats-slot').appendChild(statsRow);

    nav.innerHTML = tabBtn('scan', 'Scanner', true) + tabBtn('stats', 'Statistiques');
    bnav.innerHTML = bnavBtn('scan', 'Scanner', true) + bnavBtn('stats', 'Statistiques');
    switchTab('scan', nav.children[0]);
  }
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-link').forEach(function(t) { t.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  var p = document.getElementById('panel-' + name);
  if (p) p.classList.add('active');
  if (name === 'scan') { loadAll().then(function() { updateStats(); updatePriceModeLabel(); renderRecentScans(); }); }
  if (name === 'stats') { loadAll().then(function() { updateStats(); updatePriceModeLabel(); }); }
  if (name === 'registry') { loadAll().then(renderRegistry); }
  if (name !== 'scan') stopCamera();
}

function switchTabMobile(name) {
  var tabNames = currentRole === 'admin' ? ['generate','scan','registry'] : ['scan','stats'];
  // Update bottom nav active state
  tabNames.forEach(function(t) {
    var b = document.getElementById('bnav-' + t);
    if (b) b.classList.toggle('active', t === name);
  });
  // Also update top tab nav
  var topBtns = document.querySelectorAll('.tab-link');
  topBtns.forEach(function(b, i) {
    b.classList.toggle('active', tabNames[i] === name);
  });
  // Switch panel
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  var p = document.getElementById('panel-' + name);
  if (p) p.classList.add('active');
  if (name === 'scan') { loadAll().then(function() { updateStats(); updatePriceModeLabel(); renderRecentScans(); }); }
  if (name === 'stats') { loadAll().then(function() { updateStats(); updatePriceModeLabel(); }); }
  if (name === 'registry') { loadAll().then(renderRegistry); }
  if (name !== 'scan') stopCamera();
  // Scroll to top
  window.scrollTo(0, 0);
}

// ── Rebuild QR grid from loaded tickets ──
function rebuildGrid() {
  var grid = document.getElementById('ticket-grid');
  grid.innerHTML = '';
  var keys = Object.keys(tickets);
  if (!keys.length) return;
  keys.forEach(function(num) {
    var t = tickets[num];
    var resolvedUrl = (concertMeta.siteUrl || SITE_URL || '').replace(/\/+$/, '');
    // Short payload: id only. ticket.html loads the rest from Supabase.
    var qrBase = resolvedUrl ? (resolvedUrl + '/ticket.html') : null;
    var qrPayload = qrBase ? (qrBase + '?id=' + encodeURIComponent(num)) : num;
    var svgStr = window.makeQRSVG(qrPayload, 120);
    var div = document.createElement('div');
    div.className = 'ticket-card' + (t.used ? ' used' : '');
    div.id = 'tcard-' + num;
    div.innerHTML = svgStr +
      '<div class="ticket-num">' + num + '</div>' +
      '<div class="ticket-price">' + t.presale.toLocaleString() + ' ' + t.currency + '</div>';
    grid.appendChild(div);
  });
  document.getElementById('dl-btn').style.display = 'inline-block';
}

// ── Generate ──
// Once event info is saved, the form reflects it (no hardcoded defaults).
function fillGenerateForm() {
  if (!concertMeta || !concertMeta.name) return;
  var set = function(id, v) { var e = document.getElementById(id); if (e && v != null && v !== '') e.value = v; };
  set('concert-name', concertMeta.name);
  set('price-presale', concertMeta.presale);
  set('price-door', concertMeta.door);
  set('concert-date', concertMeta.concertDate);
  if (concertMeta.concertTime) set('concert-time', String(concertMeta.concertTime).slice(0, 5));
  if (concertMeta.currency) document.getElementById('currency').value = concertMeta.currency;
  // Prefix: infer from an existing ticket id (e.g. "TKT-001" → "TKT")
  var keys = Object.keys(tickets);
  if (keys.length) {
    var pfx = keys[0].split('-')[0];
    if (pfx) set('ticket-prefix', pfx);
  }
  updatePricePreview();
}

async function generateTickets() {
  var name = document.getElementById('concert-name').value.trim();
  var prefix = document.getElementById('ticket-prefix').value.trim();
  var count = parseInt(document.getElementById('ticket-count').value);
  var presale = parseInt(document.getElementById('price-presale').value);
  var door = parseInt(document.getElementById('price-door').value);
  var currency = document.getElementById('currency').value;
  var concertDate = document.getElementById('concert-date').value;
  var concertTime = document.getElementById('concert-time').value;
  var siteUrl = (SITE_URL || '').trim().replace(/\/+$/, '');

  // Require every field — no hardcoded defaults
  var missing = [];
  if (!name) missing.push('Nom du concert');
  if (!prefix) missing.push('Préfixe');
  if (isNaN(count) || count < 1) missing.push('Nombre de tickets');
  if (isNaN(presale)) missing.push('Prix prévente');
  if (isNaN(door)) missing.push('Prix jour J');
  if (!concertDate) missing.push('Date du concert');
  if (!concertTime) missing.push('Heure bascule jour J');
  if (missing.length) {
    alert('Renseignez d\'abord :\n- ' + missing.join('\n- '));
    return;
  }
  count = Math.min(count, 500);

  concertMeta = { name: name, presale: presale, door: door, currency: currency, concertDate: concertDate, concertTime: concertTime, siteUrl: siteUrl };

  var grid = document.getElementById('ticket-grid');

  // Find highest existing number for this prefix
  var existingMax = 0;
  Object.keys(tickets).forEach(function(k) {
    if (k.indexOf(prefix + '-') === 0) {
      var n = parseInt(k.replace(prefix + '-', ''), 10);
      if (!isNaN(n) && n > existingMax) existingMax = n;
    }
  });

  var newFrom = existingMax + 1;
  var newTo = count;

  if (newTo <= existingMax) {
    alert('Il y a déjà ' + existingMax + ' tickets ' + prefix + '. Entrez un nombre supérieur pour en ajouter.');
    return;
  }

  var newTickets = [];
  for (var i = newFrom; i <= newTo; i++) {
    var num = prefix + '-' + String(i).padStart(3, '0');
    var t = { id: num, presale: presale, door: door, currency: currency, concert: name, concertDate: concertDate, concertTime: concertTime, used: false, status: 'available', scanTime: null, soldTime: null, entryTime: null, scannedPrice: null, scannedMode: null };
    tickets[num] = t;
    newTickets.push(t);

    var resolvedUrl = siteUrl || '';
    // Short payload: id only. ticket.html loads the rest from Supabase.
    var qrBase = resolvedUrl ? (resolvedUrl + '/ticket.html') : null;
    var qrPayload = qrBase ? (qrBase + '?id=' + encodeURIComponent(num)) : num;
    var svgStr = window.makeQRSVG(qrPayload, 120);
    var div = document.createElement('div');
    div.className = 'ticket-card';
    div.id = 'tcard-' + num;
    div.innerHTML = svgStr +
      '<div class="ticket-num">' + num + '</div>' +
      '<div class="ticket-price">' + presale.toLocaleString() + ' ' + currency + '</div>';
    grid.appendChild(div);
  }

  await saveAll();
  if (sb) await dbInsertTickets(newTickets);

  document.getElementById('dl-btn').style.display = 'inline-block';
  updateStats();
}

function confirmClear() {
  var total = Object.keys(tickets).length;
  if (total === 0) { clearTickets(); return; }
  var used = Object.values(tickets).filter(function(t) { return t.status === 'sold' || t.status === 'entered'; }).length;
  var msg = 'Supprimer tous les tickets ?\n\n'
    + total + ' ticket(s) au total, dont ' + used + ' déjà utilisé(s).\n\n'
    + 'Cette action est irréversible.';
  if (window.confirm(msg)) clearTickets();
}

async function clearTickets() {
  tickets = {}; scanLog = []; concertMeta = {};
  document.getElementById('ticket-grid').innerHTML = '';
  document.getElementById('dl-btn').style.display = 'none';
  if (sb) await dbClearAll();
  updateStats();
}

// ── ZIP ──
function downloadAllZip() {
  if (!Object.keys(tickets).length) return;
  if (window.JSZip) { doZip(); return; }
  var script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  script.onload = function() { doZip(); };
  document.head.appendChild(script);
}

async function doZip() {
  var keys = Object.keys(tickets);
  var btn = document.getElementById('dl-btn');
  btn.disabled = true;
  var pw = document.getElementById('progress-wrap');
  var pf = document.getElementById('progress-fill');
  var pl = document.getElementById('progress-lbl');
  pw.style.display = 'block';
  var zip = new JSZip();
  var resolvedUrlZip = (concertMeta.siteUrl || SITE_URL || '').replace(/\/+$/, '');
  for (var i = 0; i < keys.length; i++) {
    var qrPayloadZip = resolvedUrlZip ? (resolvedUrlZip + '/ticket.html?id=' + encodeURIComponent(keys[i])) : keys[i];
    zip.file(keys[i] + '.svg', window.makeQRSVG(qrPayloadZip, 400));
    pf.style.width = Math.round((i + 1) / keys.length * 100) + '%';
    pl.textContent = (i + 1) + ' / ' + keys.length;
    if (i % 20 === 0) await new Promise(function(r) { setTimeout(r, 0); });
  }
  pl.textContent = 'Compression...';
  var blob = await zip.generateAsync({ type: 'blob' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'scanbill_qrcodes.zip'; a.click();
  pl.textContent = 'Téléchargé.';
  setTimeout(function() { pw.style.display = 'none'; btn.disabled = false; }, 1500);
}

// ── Camera ──
function toggleCamera() {
  var wrap = document.getElementById('camera-wrap');
  if (wrap.style.display === 'none' || !wrap.style.display) { startCamera(); } else { stopCamera(); }
}

function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Caméra non disponible sur cet appareil ou navigateur.'); return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) {
      camStream = stream;
      var video = document.getElementById('cam-video');
      video.srcObject = stream;
      document.getElementById('camera-wrap').style.display = 'flex';
      document.getElementById('cam-btn').textContent = 'Arrêter';
      startQRDetection();
    })
    .catch(function(err) { alert('Impossible d\'accéder à la caméra : ' + err.message); });
}

function stopCamera() {
  if (camStream) { camStream.getTracks().forEach(function(t) { t.stop(); }); camStream = null; }
  if (camInterval) { clearInterval(camInterval); camInterval = null; }
  var wrap = document.getElementById('camera-wrap');
  if (wrap) wrap.style.display = 'none';
  var btn = document.getElementById('cam-btn');
  if (btn) btn.textContent = 'Caméra';
}

function startQRDetection() {
  if ('BarcodeDetector' in window) {
    var detector = new BarcodeDetector({ formats: ['qr_code'] });
    var video = document.getElementById('cam-video');
    camInterval = setInterval(function() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        detector.detect(video).then(function(codes) {
          if (codes.length > 0) {
            document.getElementById('scan-input').value = codes[0].rawValue;
            stopCamera(); doScan();
          }
        }).catch(function() {});
      }
    }, 300);
  } else {
    loadJsQR(function() {
      var video = document.getElementById('cam-video');
      var canvas = document.getElementById('cam-canvas');
      var ctx = canvas.getContext('2d');
      camInterval = setInterval(function() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          var code = window.jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
          if (code) {
            document.getElementById('scan-input').value = code.data;
            stopCamera(); doScan();
          }
        }
      }, 300);
    });
  }
}

function loadJsQR(cb) {
  if (window.jsQR) { cb(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
  s.onload = cb;
  document.head.appendChild(s);
}

// ── Scan logic ──
var pendingTicketId = null;
var pendingAction = null;

async function doScan() {
  var input = document.getElementById('scan-input');
  var val = input.value.trim().toUpperCase();
  var box = document.getElementById('scan-result');
  var detail = document.getElementById('ticket-detail');
  if (!val) return;

  // Reload from DB to get latest state
  await loadAll();

  box.style.display = 'block';
  detail.style.display = 'none';
  pendingTicketId = null;
  pendingAction = null;
  box.className = 'scan-result';

  // Extract ticket ID — support plain ID, URL ?id=, or JSON
  var id = val;
  try {
    if (val.indexOf('?ID=') !== -1) {
      id = val.split('?ID=')[1].split('&')[0].toUpperCase();
    } else if (val.indexOf('?id=') !== -1) {
      id = val.split('?id=')[1].split('&')[0].toUpperCase();
    } else if (val.charAt(0) === '{') {
      var p = JSON.parse(val); id = String(p.id).toUpperCase();
    }
  } catch(e) {}

  var t = tickets[id];
  if (!t) {
    box.className = 'scan-result invalid';
    box.textContent = id + ' — ticket inconnu dans le système.';
  } else if (t.status === 'entered') {
    // Already inside — reject
    box.className = 'scan-result used';
    box.textContent = id + ' — déjà entré à ' + (t.entryTime || t.scanTime) + '. Refuser l\'entrée.';
    showTicketDetail(t, 'entered');
  } else if (t.status === 'sold') {
    // Second scan → confirm entry
    pendingTicketId = id;
    pendingAction = 'enter';
    box.className = 'scan-result ok';
    box.textContent = id + ' — vendu. Confirmez l\'entrée du client.';
    showTicketDetail(t, 'pending-enter');
  } else {
    // available → first scan → confirm sale
    pendingTicketId = id;
    pendingAction = 'sell';
    box.className = 'scan-result ok';
    box.textContent = id + ' — disponible. Confirmez la vente.';
    showTicketDetail(t, 'pending-sell');
  }
  input.value = '';
  input.focus();
}

async function confirmEntry() {
  if (!pendingTicketId || !pendingAction) return;
  var id = pendingTicketId;
  var action = pendingAction;
  var t = tickets[id];
  if (!t) return;

  var now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  var active = getActivePrice(t);
  var who = agentLabel(currentUserEmail);
  var box = document.getElementById('scan-result');

  if (action === 'sell') {
    t.status = 'sold';
    t.soldTime = now;
    t.scanTime = now;
    t.scannedPrice = active.price;
    t.scannedMode = active.mode;
    t.soldBy = who;
    if (sb) await dbMarkSold(id, now, active.price, active.mode, who);
      scanLog.unshift({ id: id, time: now, action: 'vendu', price: active.price, currency: t.currency, mode: active.mode });
    box.className = 'scan-result ok';
    box.textContent = id + ' — vendu · ' + active.price.toLocaleString() + ' ' + t.currency + ' · ' + now;
    showTicketDetail(t, 'sold');
    var tc = document.getElementById('tcard-' + id);
    if (tc) tc.classList.add('sold');

  } else if (action === 'enter') {
    t.status = 'entered';
    t.used = true;
    t.entryTime = now;
    t.scanTime = now;
    t.enteredBy = who;
    if (sb) await dbMarkEntered(id, now, who);
      scanLog.unshift({ id: id, time: now, action: 'entré', price: t.scannedPrice || active.price, currency: t.currency, mode: t.scannedMode || active.mode });
    box.className = 'scan-result ok';
    box.textContent = id + ' — accès accordé · ' + now;
    showTicketDetail(t, 'granted');
    var tc2 = document.getElementById('tcard-' + id);
    if (tc2) tc2.classList.add('used');
  }

  pendingTicketId = null;
  pendingAction = null;
  renderRecentScans();
  updateStats();
  document.getElementById('scan-input').focus();
}

function cancelEntry() {
  pendingTicketId = null;
  pendingAction = null;
  document.getElementById('ticket-detail').style.display = 'none';
  document.getElementById('scan-result').style.display = 'none';
  document.getElementById('scan-input').focus();
}

function showTicketDetail(t, state) {
  var active = getActivePrice(t);
  var detail = document.getElementById('ticket-detail');
  document.getElementById('td-concert').textContent = t.concert;
  document.getElementById('td-num').textContent = t.id;

  var priceToShow = t.scannedPrice || active.price;
  var modeToShow  = t.scannedMode  || active.mode;
  document.getElementById('td-price').textContent = priceToShow.toLocaleString() + ' ' + t.currency;
  document.getElementById('td-mode').innerHTML = '<span class="' + (modeToShow === 'jour J' ? 'tag-door' : 'tag-presale') + '">' + modeToShow + '</span>';

  var accessRow = document.getElementById('td-access-row');
  var accessStatus = document.getElementById('td-access-status');
  var confirmRow = document.getElementById('td-confirm-row');
  var confirmBtn = document.getElementById('td-confirm-btn');

  accessRow.style.display = 'none';
  confirmRow.style.display = 'none';

  if (state === 'pending-sell') {
    confirmBtn.textContent = 'Confirmer la vente';
    confirmBtn.classList.add('sell');
    confirmRow.style.display = 'flex';
  } else if (state === 'pending-enter') {
    accessRow.style.display = 'flex';
    accessStatus.innerHTML = '<span class="tag-presale">vendu · ' + t.soldTime + '</span>';
    confirmBtn.textContent = "Confirmer l'accès";
    confirmBtn.classList.remove('sell');
    confirmRow.style.display = 'flex';
  } else if (state === 'sold') {
    accessRow.style.display = 'flex';
    accessStatus.innerHTML = '<span class="tag-presale">vendu · ' + t.soldTime + '</span>';
  } else if (state === 'granted') {
    accessRow.style.display = 'flex';
    accessStatus.innerHTML = '<span class="tag-granted">accès accordé · ' + t.entryTime + '</span>';
  } else if (state === 'entered') {
    accessRow.style.display = 'flex';
    accessStatus.innerHTML = '<span class="tag-denied">refusé · déjà entré à ' + t.entryTime + '</span>';
  }
  detail.style.display = 'block';
}

function updatePriceModeLabel() {
  var meta = concertMeta;
  if (!meta || !meta.presale) { document.getElementById('stat-price-mode').textContent = '—'; return; }
  var active = getActivePrice(meta);
  document.getElementById('stat-price-mode').textContent = active.price.toLocaleString() + ' ' + (meta.currency || '');
}

function scanTimeSecs(s) {
  if (!s) return -1;
  var p = String(s).split(':');
  return (+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0);
}

function renderRecentScans() {
  var el = document.getElementById('recent-scans');
  if (!el) return;
  // Derive from tickets (Supabase) so recent scans survive a refresh and are
  // visible on every device/account, not just the one that scanned.
  var ev = [];
  Object.keys(tickets).forEach(function(k) {
    var t = tickets[k];
    if (t.soldTime)  ev.push({ id: t.id, action: 'vendu', time: t.soldTime });
    if (t.entryTime) ev.push({ id: t.id, action: 'entré', time: t.entryTime });
  });
  ev.sort(function(a, b) { return scanTimeSecs(b.time) - scanTimeSecs(a.time); });
  if (!ev.length) { el.innerHTML = '<p class="empty-state">Aucun scan pour l\'instant</p>'; return; }
  el.innerHTML = ev.slice(0, 8).map(function(s) {
    return '<div class="scan-log-row">' +
      '<span class="scan-log-id">' + s.id + '</span>' +
      '<span class="scan-log-price">' + (s.action || '') + '</span>' +
      '<span class="scan-log-time">' + s.time + '</span>' +
      '<span class="status-dot"></span>' +
      '</div>';
  }).join('');
}

function updateStats() {
  var total = Object.keys(tickets).length;
  var sold = Object.values(tickets).filter(function(t) { return t.status === 'sold' || t.status === 'entered'; }).length;
  var entered = Object.values(tickets).filter(function(t) { return t.status === 'entered'; }).length;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-used').textContent = sold;
  document.getElementById('stat-remaining').textContent = total - sold;
  var enteredEl = document.getElementById('stat-entered');
  if (enteredEl) enteredEl.textContent = entered;
  updatePriceModeLabel();
}

// ── Registry ──
var registrySort = { key: 'time', dir: 'desc' };
var STATUS_RANK = { available: 0, sold: 1, entered: 2 };

function regDate(d) {
  if (!d) return '';
  var p = String(d).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d;
}

function sortRegistry(key) {
  if (registrySort.key === key) {
    registrySort.dir = registrySort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    registrySort.key = key;
    registrySort.dir = 'asc';
  }
  renderRegistry();
}

function updateSortIndicators() {
  var arrow = registrySort.dir === 'asc' ? '▲' : '▼';
  ['id', 'status', 'time', 'agent'].forEach(function(k) {
    var el = document.getElementById('sort-ind-' + k);
    if (el) el.textContent = registrySort.key === k ? arrow : '';
  });
}

function renderRegistry() {
  var body = document.getElementById('registry-body');
  var all = Object.values(tickets);
  if (!all.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Génère des tickets d\'abord</td></tr>';
    updateSortIndicators();
    return;
  }
  all.sort(function(a, b) {
    var cmp;
    if (registrySort.key === 'status') {
      cmp = STATUS_RANK[a.status || 'available'] - STATUS_RANK[b.status || 'available'];
    } else if (registrySort.key === 'time') {
      cmp = scanTimeSecs(a.entryTime || a.soldTime) - scanTimeSecs(b.entryTime || b.soldTime);
    } else if (registrySort.key === 'agent') {
      cmp = String(a.soldBy || '').localeCompare(String(b.soldBy || ''));
    } else { // id
      cmp = String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    }
    if (cmp === 0) cmp = String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    return registrySort.dir === 'asc' ? cmp : -cmp;
  });
  body.innerHTML = all.map(function(t) {
    var st = t.status || 'available';
    var statusLabel = st === 'available' ? 'disponible' : st === 'sold' ? 'vendu' : 'entré';
    var statusClass = st === 'entered' ? 'status-used' : st === 'sold' ? 'status-sold' : 'status-ok';
    var priceDisplay = t.scannedPrice
      ? t.scannedPrice.toLocaleString() + ' ' + t.currency + ' (' + (t.scannedMode || '') + ')'
      : t.presale.toLocaleString() + ' ' + t.currency;
    var scanT = t.entryTime || t.soldTime;
    var timeDisplay = scanT ? ((t.concertDate ? regDate(t.concertDate) + ' · ' : '') + scanT) : '—';
    return '<tr>' +
      '<td>' + t.id + '</td>' +
      '<td class="' + statusClass + '">' + statusLabel + '</td>' +
      '<td>' + timeDisplay + '</td>' +
      '<td>' + (t.soldBy || '—') + '</td>' +
      '<td>' + priceDisplay + '</td>' +
      '</tr>';
  }).join('');
  updateSortIndicators();
}

function exportCSV() {
  var all = Object.values(tickets);
  if (!all.length) return;
  var rows = [['N° Ticket','Concert','Statut','Vendu par','Entré par','Heure vente','Heure entrée','Prix scanné','Mode tarif','Devise']];
  all.forEach(function(t) {
    var st = t.status || 'available';
    rows.push([t.id, t.concert, st, t.soldBy || '', t.enteredBy || '', t.soldTime || '', t.entryTime || '', t.scannedPrice || '', t.scannedMode || '', t.currency]);
  });
  var csv = rows.map(function(r) { return r.join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'scanbill_registre.csv'; a.click();
}
