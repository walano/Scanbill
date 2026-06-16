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
      scannedPrice: r.scanned_price, scannedMode: r.scanned_mode
    };
  });
  return map;
}

async function dbMarkSold(id, soldTime, scannedPrice, scannedMode) {
  if (!sb) return;
  await sb.from('tickets').update({
    status: 'sold', sold_time: soldTime, scan_time: soldTime,
    scanned_price: scannedPrice, scanned_mode: scannedMode
  }).eq('id', id);
}

async function dbMarkEntered(id, entryTime) {
  if (!sb) return;
  await sb.from('tickets').update({
    status: 'entered', used: true, entry_time: entryTime, scan_time: entryTime
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

  // Set default concert date
  document.getElementById('concert-date').value = new Date().toISOString().split('T')[0];

  // Price preview listeners
  ['price-presale','price-door','concert-date','concert-time','currency'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', updatePricePreview);
    document.getElementById(id).addEventListener('input', updatePricePreview);
  });
  updatePricePreview();

  // Always set role UI immediately — never skip this
  selectRole('admin');

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
function selectRole(r) {
  currentRole = r;
  document.getElementById('btn-admin').classList.toggle('active', r === 'admin');
  document.getElementById('btn-agent').classList.toggle('active', r === 'agent');
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-err').textContent = '';
}

async function tryLogin() {
  var pin = document.getElementById('pin-input').value.trim();
  var err = document.getElementById('pin-err');
  if (!pin) return;

  // Map role selection to email
  var email = currentRole === 'admin' ? 'admin@scanbill.app' : 'agent@scanbill.app';

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
    err.textContent = 'PIN incorrect.';
    document.getElementById('pin-input').value = '';
    document.getElementById('login-btn').disabled = false;
    document.getElementById('login-btn').textContent = 'Entrer';
    return;
  }

  // Read role from JWT user_metadata
  var meta = res.data.user.user_metadata || {};
  currentRole = meta.role || currentRole;

  document.getElementById('app-login').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  document.getElementById('login-btn').disabled = false;
  document.getElementById('login-btn').textContent = 'Entrer';
  loadAll().then(function() { setupShell(); });
}

async function logout() {
  stopCamera();
  if (sb) await sb.auth.signOut();
  currentRole = null;
  tickets = {}; scanLog = []; concertMeta = {};
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('app-login').style.display = 'flex';
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-err').textContent = '';
  document.getElementById('ticket-grid').innerHTML = '';
  if (document.getElementById('ticket-detail')) document.getElementById('ticket-detail').style.display = 'none';
  if (document.getElementById('scan-result')) document.getElementById('scan-result').style.display = 'none';
  selectRole('admin');
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
function setupShell() {
  var tag = document.getElementById('role-tag');
  var nav = document.getElementById('tab-nav');
  tag.textContent = currentRole === 'admin' ? 'Organisateur' : 'Agent scan';

  if (currentRole === 'admin') {
    nav.innerHTML =
      '<button class="tab-link active" onclick="switchTab(\'generate\',this)">Générer</button>' +
      '<button class="tab-link" onclick="switchTab(\'scan\',this)">Scanner</button>' +
      '<button class="tab-link" onclick="switchTab(\'registry\',this)">Registre</button>';
    rebuildGrid();
    switchTab('generate', nav.children[0]);
  } else {
    nav.innerHTML = '<button class="tab-link active" onclick="switchTab(\'scan\',this)">Scanner</button>';
    switchTab('scan', nav.children[0]);
  }
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-link').forEach(function(t) { t.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  var p = document.getElementById('panel-' + name);
  if (p) p.classList.add('active');
  if (name === 'scan') { loadAll().then(function() { updateStats(); updatePriceModeLabel(); }); }
  if (name === 'registry') { loadAll().then(renderRegistry); }
  if (name !== 'scan') stopCamera();
}

function switchTabMobile(name) {
  // Update bottom nav active state
  ['generate','scan','registry'].forEach(function(t) {
    var b = document.getElementById('bnav-' + t);
    if (b) b.classList.toggle('active', t === name);
  });
  // Also update top tab nav
  var topBtns = document.querySelectorAll('.tab-link');
  var tabNames = currentRole === 'admin' ? ['generate','scan','registry'] : ['scan'];
  topBtns.forEach(function(b, i) {
    b.classList.toggle('active', tabNames[i] === name);
  });
  // Switch panel
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  var p = document.getElementById('panel-' + name);
  if (p) p.classList.add('active');
  if (name === 'scan') { loadAll().then(function() { updateStats(); updatePriceModeLabel(); }); }
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
    // Encode concert data in QR URL params for client page
    var qrBase = resolvedUrl ? (resolvedUrl + '/ticket.html') : null;
    var qrParams = '?id=' + encodeURIComponent(num)
      + '&c=' + encodeURIComponent(name)
      + '&p=' + presale
      + '&d=' + door
      + '&cur=' + encodeURIComponent(currency)
      + (concertDate ? '&dt=' + concertDate : '')
      + (concertTime ? '&tm=' + encodeURIComponent(concertTime) : '');
    var qrPayload = qrBase ? (qrBase + qrParams) : num;
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
async function generateTickets() {
  var name = document.getElementById('concert-name').value.trim() || 'CONCERT';
  var presale = parseInt(document.getElementById('price-presale').value) || 5000;
  var door = parseInt(document.getElementById('price-door').value) || 7000;
  var currency = document.getElementById('currency').value;
  var count = Math.min(parseInt(document.getElementById('ticket-count').value) || 10, 500);
  var prefix = document.getElementById('ticket-prefix').value.trim() || 'TKT';
  var concertDate = document.getElementById('concert-date').value;
  var concertTime = document.getElementById('concert-time').value || '00:00';
  var siteUrl = (SITE_URL || '').trim().replace(/\/+$/, '');

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
    // Encode concert data in QR URL params for client page
    var qrBase = resolvedUrl ? (resolvedUrl + '/ticket.html') : null;
    var qrParams = '?id=' + encodeURIComponent(num)
      + '&c=' + encodeURIComponent(name)
      + '&p=' + presale
      + '&d=' + door
      + '&cur=' + encodeURIComponent(currency)
      + (concertDate ? '&dt=' + concertDate : '')
      + (concertTime ? '&tm=' + encodeURIComponent(concertTime) : '');
    var qrPayload = qrBase ? (qrBase + qrParams) : num;
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
    var tZip = tickets[keys[i]];
    var qrParamsZip = '?id=' + encodeURIComponent(keys[i])
      + '&c=' + encodeURIComponent(tZip.concert || '')
      + '&p=' + (tZip.presale || 0)
      + '&d=' + (tZip.door || 0)
      + '&cur=' + encodeURIComponent(tZip.currency || '')
      + (tZip.concertDate ? '&dt=' + tZip.concertDate : '')
      + (tZip.concertTime ? '&tm=' + encodeURIComponent(tZip.concertTime) : '');
    var qrPayloadZip = resolvedUrlZip ? (resolvedUrlZip + '/ticket.html' + qrParamsZip) : keys[i];
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
      document.getElementById('camera-wrap').style.display = 'block';
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
  box.className = 'scan-result';

  // Extract ticket ID — support plain ID, URL ?id=, or JSON
  var id = val;
  try {
    if (val.indexOf('?ID=') !== -1) {
      id = val.split('?ID=')[1].split('&')[0].toUpperCase();
    } else if (val.indexOf('?id=') !== -1) {
      id = val.split('?id=')[1].split('&')[0].toUpperCase();
    } else {
      var p = JSON.parse(val); id = p.id.toUpperCase();
    }
  } catch(e) {}

  if (!tickets[id]) {
    box.className = 'scan-result invalid';
    box.textContent = id + ' — ticket inconnu dans le système.';
  } else if (tickets[id].used) {
    var t = tickets[id];
    box.className = 'scan-result used';
    box.textContent = id + ' — déjà utilisé à ' + t.scanTime + '. Refuser l\'entrée.';
    showTicketDetail(t, 'used');
  } else {
    pendingTicketId = id;
    box.className = 'scan-result ok';
    box.textContent = id + ' — ticket valide. Confirmez l\'entrée.';
    showTicketDetail(tickets[id], 'pending');
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
  var box = document.getElementById('scan-result');

  if (action === 'sell') {
    t.status = 'sold';
    t.soldTime = now;
    t.scanTime = now;
    t.scannedPrice = active.price;
    t.scannedMode = active.mode;
    if (sb) await dbMarkSold(id, now, active.price, active.mode);
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
    if (sb) await dbMarkEntered(id, now);
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
    confirmRow.style.display = 'flex';
  } else if (state === 'pending-enter') {
    accessRow.style.display = 'flex';
    accessStatus.innerHTML = '<span class="tag-presale">vendu · ' + t.soldTime + '</span>';
    confirmBtn.textContent = 'Confirmer l'accès';
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

function renderRecentScans() {
  var el = document.getElementById('recent-scans');
  if (!scanLog.length) { el.innerHTML = '<p class="empty-state">Aucun scan pour l\'instant</p>'; return; }
  el.innerHTML = scanLog.slice(0, 8).map(function(s) {
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
  var used = Object.values(tickets).filter(function(t) { return t.status === 'sold' || t.status === 'entered'; }).length;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-used').textContent = sold;
  document.getElementById('stat-remaining').textContent = total - sold;
  var enteredEl = document.getElementById('stat-entered');
  if (enteredEl) enteredEl.textContent = entered;
  updatePriceModeLabel();
}

// ── Registry ──
function renderRegistry() {
  var body = document.getElementById('registry-body');
  var all = Object.values(tickets);
  if (!all.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty-state">Génère des tickets d\'abord</td></tr>';
    return;
  }
  body.innerHTML = all.map(function(t) {
    var st = t.status || 'available';
    var statusLabel = st === 'available' ? 'disponible' : st === 'sold' ? 'vendu' : 'entré';
    var statusClass = st === 'entered' ? 'status-used' : st === 'sold' ? 'status-sold' : 'status-ok';
    var priceDisplay = t.scannedPrice
      ? t.scannedPrice.toLocaleString() + ' ' + t.currency + ' (' + (t.scannedMode || '') + ')'
      : t.presale.toLocaleString() + ' ' + t.currency;
    var timeDisplay = t.entryTime || t.soldTime || '—';
    return '<tr>' +
      '<td>' + t.id + '</td>' +
      '<td class="' + statusClass + '">' + statusLabel + '</td>' +
      '<td>' + timeDisplay + '</td>' +
      '<td>' + priceDisplay + '</td>' +
      '</tr>';
  }).join('');
}

function exportCSV() {
  var all = Object.values(tickets);
  if (!all.length) return;
  var rows = [['N° Ticket','Concert','Statut','Heure vente','Heure entrée','Prix scanné','Mode tarif','Devise']];
  all.forEach(function(t) {
    var st = t.status || 'available';
    rows.push([t.id, t.concert, st, t.soldTime || '', t.entryTime || '', t.scannedPrice || '', t.scannedMode || '', t.currency]);
  });
  var csv = rows.map(function(r) { return r.join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'scanbill_registre.csv'; a.click();
}
