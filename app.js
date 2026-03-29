// =========================================
// 口袋名單 — app.js
// Firebase Firestore 即時同步版
// =========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── State ──────────────────────────────────
let db = null;
let unsubscribe = null;
let places = [];
let editingId = null;
let currentView = 'card';
let filters = { region: '', cat: '', tags: [], visited: '' };

// ── Firebase Init ──────────────────────────
function loadConfig() {
  try {
    const raw = localStorage.getItem('fb_config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function initFirebase(config) {
  if (!config || !config.apiKey || !config.projectId) return false;
  try {
    const app = initializeApp(config, 'pocket-list');
    db = getFirestore(app);
    subscribeToPlaces();
    return true;
  } catch (e) {
    console.error('Firebase init error:', e);
    return false;
  }
}

function subscribeToPlaces() {
  if (unsubscribe) unsubscribe();
  if (!db) return;
  const col = collection(db, 'places');
  unsubscribe = onSnapshot(col,
    (snap) => {
      places = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      places.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setSync('connected');
      render();
    },
    (err) => {
      console.error('Firestore error:', err);
      setSync('error');
    }
  );
}

function setSync(state) {
  const el = document.getElementById('sync-status');
  if (state === 'connected') {
    el.textContent = '● 已同步';
    el.className = 'header-sync connected';
  } else if (state === 'error') {
    el.textContent = '● 未連線（本機模式）';
    el.className = 'header-sync error';
  } else {
    el.textContent = '● 連線中...';
    el.className = 'header-sync';
  }
}

// ── Offline fallback (localStorage) ────────
function localLoad() {
  try {
    const raw = localStorage.getItem('places_local');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function localSave(data) {
  localStorage.setItem('places_local', JSON.stringify(data));
}

// ── CRUD ────────────────────────────────────
async function addPlace(data) {
  if (db) {
    await addDoc(collection(db, 'places'), { ...data, createdAt: serverTimestamp() });
  } else {
    const newPlace = { ...data, id: crypto.randomUUID(), createdAt: Date.now() };
    places.unshift(newPlace);
    localSave(places);
    render();
  }
}

async function updatePlace(id, data) {
  if (db) {
    await updateDoc(doc(db, 'places', id), { ...data, updatedAt: serverTimestamp() });
  } else {
    const idx = places.findIndex(p => p.id === id);
    if (idx >= 0) { places[idx] = { ...places[idx], ...data }; localSave(places); render(); }
  }
}

async function deletePlace(id) {
  if (db) {
    await deleteDoc(doc(db, 'places', id));
  } else {
    places = places.filter(p => p.id !== id);
    localSave(places);
    render();
  }
}

// ── Render ────────────────────────────────
function getFiltered() {
  const q = document.getElementById('search-input')?.value?.toLowerCase() || '';
  return places.filter(p => {
    if (filters.region && p.region !== filters.region) return false;
    if (filters.cat && p.cat !== filters.cat) return false;
    if (filters.tags.length && !filters.tags.every(t => (p.tags || []).includes(t))) return false;
    if (filters.visited === 'visited' && !p.visited) return false;
    if (filters.visited === 'unvisited' && p.visited) return false;
    if (q && !p.name?.toLowerCase().includes(q) && !p.note?.toLowerCase().includes(q)) return false;
    return true;
  });
}

const CAT_EMOJI = {
  '咖啡下午茶':'☕','正餐飽食':'🍱','輕食小吃':'🥯',
  '親子休閒':'🎡','微醺餐酒':'🥂','文具生活':'✏️','其他':'📍'
};

function render() {
  const filtered = getFiltered();
  const grid = document.getElementById('card-grid');
  const emptyFiltered = document.getElementById('empty-state');
  const noData = document.getElementById('no-data-state');
  const resultsBar = document.getElementById('results-bar');
  const hasFilters = filters.region || filters.cat || filters.tags.length ||
    filters.visited || document.getElementById('search-input')?.value;

  if (hasFilters) {
    resultsBar.style.display = 'flex';
    document.getElementById('results-text').textContent = `找到 ${filtered.length} 個地點`;
  } else {
    resultsBar.style.display = 'none';
  }

  if (places.length === 0) {
    grid.innerHTML = '';
    emptyFiltered.style.display = 'none';
    noData.style.display = 'block';
    return;
  }
  noData.style.display = 'none';

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyFiltered.style.display = 'block';
    return;
  }
  emptyFiltered.style.display = 'none';

  if (currentView === 'list') {
    grid.className = 'card-grid list-mode';
    grid.innerHTML = filtered.map(p => renderListCard(p)).join('');
  } else {
    grid.className = 'card-grid';
    grid.innerHTML = filtered.map(p => renderCard(p)).join('');
  }

  // Update stats in settings if open
  renderStats();
}

function renderCard(p) {
  const emoji = CAT_EMOJI[p.cat] || '📍';
  const imgHtml = p.img
    ? `<img src="${escHtml(p.img)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const placeholderStyle = p.img ? 'style="display:none"' : '';
  const visitedBadge = p.visited ? '<div class="card-visited-badge">✅</div>' : '';
  const tagsHtml = (p.tags || []).slice(0, 3).map(t => `<span class="card-tag">${escHtml(t)}</span>`).join('');
  return `
    <div class="place-card" onclick="App.openDetail('${p.id}')">
      <div class="card-img-wrap">
        ${imgHtml}
        <div class="card-img-placeholder" ${placeholderStyle}>${emoji}</div>
        ${visitedBadge}
      </div>
      <div class="card-body">
        <div class="card-name">${escHtml(p.name)}</div>
        <div class="card-meta">${escHtml(p.region)}</div>
        <div class="card-cat">${escHtml(p.cat)}</div>
        <div class="card-tags">${tagsHtml}</div>
      </div>
    </div>`;
}

function renderListCard(p) {
  const emoji = CAT_EMOJI[p.cat] || '📍';
  const imgHtml = p.img
    ? `<img src="${escHtml(p.img)}" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.textContent='${emoji}'">`
    : emoji;
  const visitedDot = p.visited ? '<span class="list-visited"></span>' : '';
  const tagsStr = (p.tags || []).slice(0, 2).join(' · ');
  return `
    <div class="list-card" onclick="App.openDetail('${p.id}')">
      <div class="list-icon">${imgHtml}</div>
      <div class="list-info">
        <div class="list-name">${escHtml(p.name)}${visitedDot}</div>
        <div class="list-meta">${escHtml(p.region)}${tagsStr ? ' · ' + escHtml(tagsStr) : ''}</div>
        <div class="list-cat">${escHtml(p.cat)}</div>
      </div>
      <div class="list-arrow">›</div>
    </div>`;
}

function renderStats() {
  const el = document.getElementById('stats-area');
  if (!el) return;
  const visited = places.filter(p => p.visited).length;
  const cats = {};
  places.forEach(p => { cats[p.cat] = (cats[p.cat] || 0) + 1; });
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  el.innerHTML = `
    <div class="stat-card"><div class="stat-num">${places.length}</div><div class="stat-label">總收藏</div></div>
    <div class="stat-card"><div class="stat-num">${visited}</div><div class="stat-label">已去過</div></div>
    <div class="stat-card"><div class="stat-num">${places.length - visited}</div><div class="stat-label">想去清單</div></div>
    <div class="stat-card"><div class="stat-num" style="font-size:16px">${topCat ? escHtml(topCat[0]) : '-'}</div><div class="stat-label">最多分類</div></div>`;
}

// ── Modals ────────────────────────────────
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.body.style.overflow = '';
}

function overlayClose(event, id) {
  if (event.target === event.currentTarget) closeModal(id);
}

// ── Add / Edit Place Modal ─────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modal-place-title').textContent = '新增地點';
  document.getElementById('place-form').reset();
  document.getElementById('img-preview').style.display = 'none';
  document.querySelectorAll('.tag-sel-btn').forEach(b => b.classList.remove('active'));
  openModal('modal-place');
}

function openEditModal(id) {
  const p = places.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('modal-place-title').textContent = '編輯地點';
  document.getElementById('f-name').value = p.name || '';
  document.getElementById('f-region').value = p.region || '';
  document.getElementById('f-cat').value = p.cat || '';
  document.getElementById('f-map').value = p.mapLink || '';
  document.getElementById('f-source').value = p.source || '';
  document.getElementById('f-img').value = p.img || '';
  document.getElementById('f-note').value = p.note || '';
  document.getElementById('f-visited').checked = !!p.visited;
  // Preview image
  if (p.img) {
    document.getElementById('img-preview').style.display = 'block';
    document.getElementById('img-preview-img').src = p.img;
  } else {
    document.getElementById('img-preview').style.display = 'none';
  }
  // Tags
  document.querySelectorAll('.tag-sel-btn').forEach(b => {
    b.classList.toggle('active', (p.tags || []).includes(b.dataset.val));
  });
  closeModal('modal-detail');
  openModal('modal-place');
}

async function savePlace() {
  const name = document.getElementById('f-name').value.trim();
  const region = document.getElementById('f-region').value;
  const cat = document.getElementById('f-cat').value;
  if (!name || !region || !cat) { showToast('請填寫必填欄位'); return; }
  const tags = [...document.querySelectorAll('.tag-sel-btn.active')].map(b => b.dataset.val);
  const data = {
    name,
    region,
    cat,
    mapLink: document.getElementById('f-map').value.trim(),
    source: document.getElementById('f-source').value.trim(),
    img: document.getElementById('f-img').value.trim(),
    note: document.getElementById('f-note').value.trim(),
    visited: document.getElementById('f-visited').checked,
    tags,
  };
  try {
    if (editingId) { await updatePlace(editingId, data); showToast('已更新 ✓'); }
    else { await addPlace(data); showToast('已新增 ✓'); }
    closeModal('modal-place');
  } catch (e) { console.error(e); showToast('儲存失敗，請重試'); }
}

// ── Detail Modal ──────────────────────────
function openDetail(id) {
  const p = places.find(x => x.id === id);
  if (!p) return;
  document.getElementById('detail-name').textContent = p.name;
  const body = document.getElementById('detail-body');
  const tagsHtml = (p.tags || []).map(t => `<span class="detail-badge">${escHtml(t)}</span>`).join('');
  body.innerHTML = `
    ${p.img ? `<img class="detail-img" src="${escHtml(p.img)}" alt="" onerror="this.remove()">` : ''}
    <div class="detail-meta">
      <span class="detail-badge">${escHtml(p.region)}</span>
      <span class="detail-badge">${escHtml(p.cat)}</span>
      ${p.visited ? '<span class="detail-badge visited">✅ 已去過</span>' : '<span class="detail-badge">📍 想去</span>'}
    </div>
    ${tagsHtml ? `<div class="detail-tags" style="margin-bottom:14px">${tagsHtml}</div>` : ''}
    ${p.note ? `<div class="detail-section"><div class="detail-section-label">備註</div><div class="detail-section-value">${escHtml(p.note)}</div></div>` : ''}
    ${p.source ? `<div class="detail-section"><div class="detail-section-label">推薦來源</div><a class="detail-link" href="${escHtml(p.source)}" target="_blank">查看來源 →</a></div>` : ''}
  `;
  // Buttons
  document.getElementById('detail-map-btn').onclick = () => {
    if (p.mapLink) window.open(p.mapLink, '_blank');
    else showToast('尚未設定 Map 連結');
  };
  document.getElementById('detail-edit-btn').onclick = () => openEditModal(id);
  document.getElementById('detail-delete-btn').onclick = () => confirmDelete(id, p.name);
  openModal('modal-detail');
}

function confirmDelete(id, name) {
  if (confirm(`確定要刪除「${name}」嗎？`)) {
    deletePlace(id).then(() => { showToast('已刪除'); closeModal('modal-detail'); });
  }
}

// ── Settings ──────────────────────────────
function openSettings() {
  const cfg = loadConfig() || {};
  document.getElementById('cfg-apiKey').value = cfg.apiKey || '';
  document.getElementById('cfg-authDomain').value = cfg.authDomain || '';
  document.getElementById('cfg-projectId').value = cfg.projectId || '';
  document.getElementById('cfg-storageBucket').value = cfg.storageBucket || '';
  renderStats();
  openModal('modal-settings');
}

async function saveFirebaseConfig() {
  const config = {
    apiKey: document.getElementById('cfg-apiKey').value.trim(),
    authDomain: document.getElementById('cfg-authDomain').value.trim(),
    projectId: document.getElementById('cfg-projectId').value.trim(),
    storageBucket: document.getElementById('cfg-storageBucket').value.trim(),
  };
  if (!config.apiKey || !config.projectId) {
    showFirebaseStatus('請填寫 API Key 和 Project ID', 'err');
    return;
  }
  localStorage.setItem('fb_config', JSON.stringify(config));
  const ok = await initFirebase(config);
  if (ok) {
    showFirebaseStatus('✅ 連線成功！資料即時同步中', 'ok');
    showToast('Firebase 已連線 🔥');
  } else {
    showFirebaseStatus('❌ 連線失敗，請確認設定是否正確', 'err');
  }
}

function showFirebaseStatus(msg, type) {
  const el = document.getElementById('firebase-status');
  el.textContent = msg;
  el.className = `firebase-status ${type}`;
}

// ── Filter Logic ───────────────────────────
function setupFilters() {
  // Single-select chips (region, cat, visited)
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.dataset.group;
      document.querySelectorAll(`.chip[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filters[group] = chip.dataset.val;
      render();
    });
  });
  // Multi-select tag chips
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.val;
      chip.classList.toggle('active');
      if (filters.tags.includes(val)) filters.tags = filters.tags.filter(t => t !== val);
      else filters.tags.push(val);
      render();
    });
  });
}

function clearFilters() {
  filters = { region: '', cat: '', tags: [], visited: '' };
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.val === '');
  });
  document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('search-input').value = '';
  render();
}

// ── View ──────────────────────────────────
function setView(v) {
  currentView = v;
  document.getElementById('vt-card').classList.toggle('active', v === 'card');
  document.getElementById('vt-list').classList.toggle('active', v === 'list');
  render();
}

// ── Image Preview ─────────────────────────
function setupImgPreview() {
  document.getElementById('f-img').addEventListener('input', function() {
    const url = this.value.trim();
    const preview = document.getElementById('img-preview');
    const img = document.getElementById('img-preview-img');
    if (url) {
      img.src = url;
      img.onload = () => { preview.style.display = 'block'; };
      img.onerror = () => { preview.style.display = 'none'; };
    } else {
      preview.style.display = 'none';
    }
  });
}

// ── Tag Selector in Form ──────────────────
function setupTagSelector() {
  document.querySelectorAll('.tag-sel-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });
}

// ── Export / Import ───────────────────────
function exportJSON() {
  const data = places.map(({ id, createdAt, updatedAt, ...rest }) => rest);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `口袋名單_${dateStr()}.json`);
  showToast('JSON 已匯出 ✓');
}

function exportCSV() {
  const headers = ['店名','地區','分類','標籤','備註','去過了','Map連結','來源','圖片'];
  const rows = places.map(p => [
    p.name, p.region, p.cat, (p.tags || []).join('|'), p.note || '',
    p.visited ? '是' : '否', p.mapLink || '', p.source || '', p.img || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `口袋名單_${dateStr()}.csv`);
  showToast('CSV 已匯出 ✓');
}

async function importJSON(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('格式錯誤');
    const existing = new Set(places.map(p => p.name));
    let added = 0;
    for (const item of data) {
      if (!item.name) continue;
      if (existing.has(item.name)) continue;
      await addPlace(item);
      added++;
    }
    showToast(`匯入完成，新增 ${added} 筆`);
    input.value = '';
  } catch (e) {
    console.error(e);
    showToast('匯入失敗：格式錯誤');
  }
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Utils ─────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Search ────────────────────────────────
function setupSearch() {
  const toggle = document.getElementById('btn-search-toggle');
  const bar = document.getElementById('search-bar');
  const input = document.getElementById('search-input');
  const clear = document.getElementById('btn-search-clear');

  toggle.addEventListener('click', () => {
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) setTimeout(() => input.focus(), 300);
  });
  clear.addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  input.addEventListener('input', render);
}

// ── Boot ──────────────────────────────────
window.App = {
  setView, clearFilters, openDetail, openEditModal,
  savePlace, saveFirebaseConfig, closeModal, overlayClose,
  exportJSON, exportCSV, importJSON,
};

async function boot() {
  // Try Firebase first
  const cfg = loadConfig();
  if (cfg && cfg.apiKey) {
    const ok = await initFirebase(cfg);
    if (!ok) {
      // Fallback to local
      places = localLoad();
      setSync('error');
      render();
    }
  } else {
    places = localLoad();
    setSync('error');
    render();
  }

  setupFilters();
  setupSearch();
  setupImgPreview();
  setupTagSelector();

  document.getElementById('fab-add').addEventListener('click', openAddModal);
  document.getElementById('btn-settings').addEventListener('click', openSettings);

  // Hide splash
  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
    document.getElementById('app').style.display = 'block';
  }, 800);
}

boot();
