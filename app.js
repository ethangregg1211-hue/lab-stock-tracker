// ===== FIELD DEFINITIONS =====
const FIELDS = {
  antibody: [
    { key: 'catalog_number', label: 'Catalog #',         required: true },
    { key: 'lot_number',     label: 'Lot #' },
    { key: 'target',         label: 'Target / Antigen' },
    { key: 'host_species',   label: 'Host species' },
    { key: 'clone',          label: 'Clone' },
    { key: 'concentration',  label: 'Concentration' },
    { key: 'expiry',         label: 'Expiry date',       type: 'date' },
    { key: 'storage',        label: 'Storage condition' },
  ],
  box: [
    { key: 'sample_name',   label: 'Sample name',        required: true },
    { key: 'date',          label: 'Date',               type: 'date' },
    { key: 'researcher',    label: 'Researcher initials' },
    { key: 'volume',        label: 'Volume / Amount' },
    { key: 'description',   label: 'Description' },
  ],
  histology: [
    { key: 'accession_number', label: 'Accession #',     required: true },
    { key: 'slide_number',     label: 'Slide #' },
    { key: 'stain',            label: 'Stain type' },
    { key: 'tissue',           label: 'Tissue type' },
    { key: 'diagnosis',        label: 'Diagnosis' },
    { key: 'date',             label: 'Date',            type: 'date' },
    { key: 'researcher',       label: 'Researcher' },
    { key: 'block_id',         label: 'Block ID' },
  ],
};

const SESSION_LABELS = { antibody: 'Antibody stocks', box: 'Box inventory', histology: 'Histology slides' };
const SCAN_SCREENS   = { antibody: 'antibody-scan',   box: 'box-scan',      histology: 'histology-scan' };
const CONFLICT_KEYS  = { antibody: ['catalog_number','lot_number'], histology: ['accession_number','slide_number'] };

// ===== STATE =====
const state = {
  screen: 'home',
  prevScreen: null,
  sessionType: null,
  sessionId: null,
  totalScans: 0,
  items: [],
  reviewQueue: [],
  currentBox: { number: '', label: '', size: null, posIndex: 0, positions: {} },
  lastScans: [],
  pendingResult: null,
  pendingConflict: null,
  uploadedHeaders: [],
  uploadedRows: [],
};

// ===== NAVIGATION =====
function showScreen(id) {
  if (id === state.screen) return;

  const leavingScan = ['box-scan','antibody-scan','histology-scan'].includes(state.screen);
  const enteringScan = ['box-scan','antibody-scan','histology-scan'].includes(id);
  if (leavingScan && !enteringScan) stopCamera();

  state.prevScreen = state.screen;
  state.screen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');

  updateReviewBadges();
  _onEnter(id);
}

function goBack() {
  showScreen(state.prevScreen || 'home');
}

function showScanScreen() {
  if (!state.sessionType) { showScreen('home'); return; }
  showScreen(SCAN_SCREENS[state.sessionType]);
}

function _onEnter(id) {
  const inits = {
    'home':             initHome,
    'box-setup':        initBoxSetup,
    'box-scan':         initBoxScan,
    'antibody-scan':    initAntibodyScan,
    'histology-scan':   initHistologyScan,
    'review-queue':     renderReviewQueue,
    'sheet-view':       renderSheetView,
    'end-box':          renderEndBox,
  };
  if (inits[id]) inits[id]();
}

// ===== HOME =====
function initHome() {
  loadSession().then(session => {
    const card = document.getElementById('resumeCard');
    if (session && session.sessionType) {
      document.getElementById('resumeType').textContent = SESSION_LABELS[session.sessionType] || session.sessionType;
      const n = session.items?.length || 0;
      document.getElementById('resumeMeta').textContent = `${n} item${n !== 1 ? 's' : ''} scanned`;
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  }).catch(() => {});
}

// ===== SESSION MANAGEMENT =====
function startSession(type) {
  Object.assign(state, {
    sessionType: type,
    sessionId: Date.now().toString(),
    totalScans: 0,
    items: [],
    reviewQueue: [],
    lastScans: [],
    pendingResult: null,
    pendingConflict: null,
    currentBox: { number: '', label: '', size: null, posIndex: 0, positions: {} },
  });
  showScreen(type === 'box' ? 'box-setup' : SCAN_SCREENS[type]);
}

async function resumeSessionFromDB() {
  const session = await loadSession();
  if (!session) return;
  Object.assign(state, {
    sessionType: session.sessionType,
    sessionId:   session.sessionId,
    totalScans:  session.totalScans  || 0,
    items:       session.items       || [],
    reviewQueue: session.reviewQueue || [],
    lastScans:   session.lastScans   || [],
    currentBox:  session.currentBox  || { number: '', label: '', size: null, posIndex: 0, positions: {} },
  });
  document.getElementById('resumeCard').classList.add('hidden');
  showScreen(state.sessionType === 'box' ? 'box-scan' : SCAN_SCREENS[state.sessionType]);
}

async function discardSessionFromDB() {
  await clearSession();
  document.getElementById('resumeCard').classList.add('hidden');
}

async function persistSession() {
  try {
    await saveSession({
      sessionType: state.sessionType,
      sessionId:   state.sessionId,
      totalScans:  state.totalScans,
      items:       state.items,
      reviewQueue: state.reviewQueue,
      lastScans:   state.lastScans,
      currentBox:  state.currentBox,
    });
  } catch (e) {
    console.warn('Session save failed', e);
  }
}

// ===== BOX SETUP =====
function initBoxSetup() {
  document.getElementById('boxNumber').value = '';
  document.getElementById('boxLabel').value  = '';
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('size-btn--active'));
  document.getElementById('gridHint').classList.add('hidden');
  document.getElementById('boxGrid').innerHTML = '';
  document.getElementById('startBoxScanBtn').disabled = true;
  state.currentBox = { number: '', label: '', size: null, posIndex: 0, positions: {} };
}

function validateBoxSetup() {
  const ok = document.getElementById('boxNumber').value.trim() && state.currentBox.size;
  document.getElementById('startBoxScanBtn').disabled = !ok;
}

function renderBoxGrid() {
  const { size, positions, posIndex } = state.currentBox;
  const grid = document.getElementById('boxGrid');
  if (!size) { grid.innerHTML = ''; return; }
  const [rows, cols] = size.split('x').map(Number);
  grid.style.gridTemplateColumns = `repeat(${cols + 1}, 28px)`;
  grid.innerHTML = '';

  // col-number header row
  _gridCell(grid, '', 'grid-cell--label', 'font-size:9px');
  for (let c = 1; c <= cols; c++) _gridCell(grid, c, 'grid-cell--label', 'font-size:9px;color:var(--text-muted);display:flex;align-items:center;justify-content:center');

  for (let r = 0; r < rows; r++) {
    _gridCell(grid, String.fromCharCode(65 + r), 'grid-cell--label', 'font-size:9px;color:var(--text-muted);display:flex;align-items:center;justify-content:center');
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const key = `${String.fromCharCode(65 + r)}${c + 1}`;
      const cls = positions[key] ? 'grid-cell--filled' : idx === posIndex ? 'grid-cell--next' : '';
      _gridCell(grid, '', cls);
    }
  }
}

function _gridCell(parent, text, cls, style) {
  const d = document.createElement('div');
  d.className = 'grid-cell ' + (cls || '');
  if (style) d.style.cssText = style;
  if (text !== '') d.textContent = text;
  parent.appendChild(d);
}

function posKeyFromIndex(index, size) {
  if (!size) return '';
  const [, cols] = size.split('x').map(Number);
  return `${String.fromCharCode(65 + Math.floor(index / cols))}${(index % cols) + 1}`;
}

function boxCapacity(size) {
  if (!size) return 0;
  const [r, c] = size.split('x').map(Number);
  return r * c;
}

// ===== BOX SCAN =====
async function initBoxScan() {
  _updateBoxStatus();
  _checkScanCap();
  renderUndoStrip();
  renderLastScanned();
  const ok = await startCamera('boxCameraSlot');
  if (!ok) document.getElementById('boxReadBtn').disabled = true;
}

function _updateBoxStatus() {
  const { number, size, posIndex, positions } = state.currentBox;
  const cap = boxCapacity(size);
  document.getElementById('bsBox').textContent   = number ? `Box ${number}` : 'Box —';
  document.getElementById('bsPos').textContent   = size ? `${posKeyFromIndex(posIndex, size)} (${Object.keys(positions).length}/${cap})` : '—';
  document.getElementById('bsTotal').textContent = `${state.totalScans} scan${state.totalScans !== 1 ? 's' : ''}`;
}

function _checkScanCap() {
  const banner = document.getElementById('scanCapBanner');
  const over500 = state.totalScans >= 500;
  ['boxReadBtn','abReadBtn','histReadBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = over500;
  });
  if (banner) banner.classList.toggle('hidden', state.totalScans < 450);
}

// ===== ANTIBODY SCAN =====
async function initAntibodyScan() {
  document.getElementById('abTotal').textContent = `${state.totalScans} scans`;
  _checkScanCap();
  renderUndoStrip();
  renderLastScanned();
  await startCamera('abCameraSlot');
}

// ===== HISTOLOGY SCAN =====
async function initHistologyScan() {
  document.getElementById('histTotal').textContent = `${state.totalScans} scans`;
  _checkScanCap();
  renderUndoStrip();
  renderLastScanned();
  await startCamera('histCameraSlot');
}

// ===== READ LABEL =====
async function handleReadLabel(sessionType) {
  if (!isCameraActive()) {
    showManualEntry('Camera unavailable — enter details manually.');
    return;
  }
  showLoading('Reading label…');
  try {
    const base64 = captureFrame();
    const result = await readLabelWithClaude(base64, sessionType);
    hideLoading();
    state.pendingResult = result;

    const isHist = sessionType === 'histology';
    const screenId = isHist ? 'histology-result' : 'box-result';
    const cardId   = isHist ? 'histResultCard' : 'boxResultCard';
    showScreen(screenId);
    renderResultCard(FIELDS[sessionType], result, document.getElementById(cardId));
  } catch (err) {
    hideLoading();
    showManualEntry(err.message);
  }
}

// ===== MANUAL ENTRY =====
function showManualEntry(reason) {
  document.getElementById('manualReason').textContent = reason || 'Enter details manually.';
  _buildManualForm();
  showScreen('manual-entry');
}

function _buildManualForm() {
  const fields = FIELDS[state.sessionType] || [];
  document.getElementById('manualFormFields').innerHTML = fields.map(f => `
    <label class="field-group">
      <span class="field-label">${esc(f.label)}${f.required ? ' *' : ''}</span>
      <input type="${f.type || 'text'}" name="${f.key}" class="input"
        placeholder="${f.required ? 'Required' : ''}">
    </label>`).join('');
}

// ===== RESULT CARD =====
function renderResultCard(fieldDefs, apiResult, container) {
  const sure = [], uncertain = [], unreadable = [];
  fieldDefs.forEach(f => {
    const r = apiResult[f.key] || { value: null, confidence: 'low' };
    if (r.confidence === 'high' && r.value)      sure.push({ ...f, value: r.value });
    else if (r.confidence === 'medium')           uncertain.push({ ...f, value: r.value });
    else                                          unreadable.push({ ...f });
  });

  let html = '';

  if (sure.length) {
    html += `<div class="result-section">
      <div class="result-section__header" onclick="toggleSureSection(this)">
        <span class="result-dot result-dot--green"></span>
        <span class="result-section__title">Confident <span class="result-count">${sure.length}</span></span>
        <span class="result-toggle">▼</span>
      </div>
      <div class="result-chips">
        ${sure.map(f => `<span class="field-chip"><strong>${esc(f.label)}:</strong> ${esc(f.value)}</span>`).join('')}
      </div>
      <div class="result-expanded hidden">
        ${sure.map(f => _fieldInputHtml(f, 'sure')).join('')}
      </div>
    </div>`;
  }

  if (uncertain.length) {
    html += `<div class="result-section result-section--uncertain">
      <div class="result-section__header">
        <span class="result-dot result-dot--amber"></span>
        <span class="result-section__title">Uncertain <span class="result-count">${uncertain.length}</span></span>
      </div>
      <div class="result-fields">${uncertain.map(f => _fieldInputHtml(f, 'uncertain')).join('')}</div>
    </div>`;
  }

  if (unreadable.length) {
    html += `<div class="result-section result-section--unreadable">
      <div class="result-section__header">
        <span class="result-dot result-dot--red"></span>
        <span class="result-section__title">Unreadable <span class="result-count">${unreadable.length}</span></span>
      </div>
      <div class="result-fields">${unreadable.map(f => _fieldInputHtml(f, 'unreadable')).join('')}</div>
    </div>`;
  }

  container.innerHTML = html || '<p class="muted-text" style="padding:12px">No fields detected.</p>';
}

function _fieldInputHtml(field, kind) {
  const val = kind === 'uncertain' ? `${esc(field.value || '')}?` : '';
  const hint = kind === 'uncertain' && field.value
    ? `<p class="field-hint">AI read: "${esc(field.value)}"</p>` : '';
  return `<div class="field-row field-row--${kind}">
    <label class="field-label">${esc(field.label)}</label>
    ${kind === 'unreadable' ? '<span class="eye-off" title="Unreadable">🙈</span>' : ''}
    <input type="${field.type || 'text'}" class="input field-input" name="${field.key}"
      value="${val}" placeholder="${kind === 'unreadable' ? 'Enter manually' : ''}">
    ${hint}
  </div>`;
}

function toggleSureSection(headerEl) {
  const section = headerEl.closest('.result-section');
  const expanded = section.querySelector('.result-expanded');
  const toggle   = section.querySelector('.result-toggle');
  if (expanded) expanded.classList.toggle('hidden');
  if (toggle)   toggle.classList.toggle('open');
}

function collectResultValues(cardEl) {
  const values = {};
  cardEl.querySelectorAll('.field-input').forEach(input => {
    values[input.name] = input.value.replace(/\?$/, '').trim();
  });
  return values;
}

// ===== CONFIRM SCANS =====
async function confirmBoxScan(values) {
  const { size, posIndex, positions, number, label } = state.currentBox;
  const cap = boxCapacity(size);
  if (posIndex >= cap) { alert('Box is full — end this box to start a new one.'); return; }

  const posKey = posKeyFromIndex(posIndex, size);
  const item = { type: 'box', sessionId: state.sessionId, fields: values, position: posKey, boxNumber: number, boxLabel: label, status: 'auto' };
  const id = await addItemToDB(item);
  item.id = id;
  state.items.push(item);
  state.currentBox.positions[posKey] = id;
  state.currentBox.posIndex++;
  state.totalScans++;
  _pushUndo({ id, displayName: values.sample_name || posKey, position: posKey });
  await persistSession();
  showScreen('box-scan');
}

async function confirmAntibodyScan(values) {
  const conflict = _findConflict('antibody', values);
  if (conflict) {
    state.pendingConflict = { existing: conflict, incoming: values };
    _renderConflictView();
    showScreen('antibody-conflict');
    return;
  }
  const item = { type: 'antibody', sessionId: state.sessionId, fields: values, status: 'auto' };
  const id = await addItemToDB(item);
  item.id = id;
  state.items.push(item);
  state.totalScans++;
  _pushUndo({ id, displayName: values.catalog_number || values.target || 'Unknown' });
  await persistSession();
  showScreen('antibody-scan');
}

async function confirmHistologyScan(values) {
  const conflict = _findConflict('histology', values);
  if (conflict) {
    addToReviewQueue(values, 'conflict');
    showScreen('histology-scan');
    return;
  }
  const item = { type: 'histology', sessionId: state.sessionId, fields: values, status: 'auto' };
  const id = await addItemToDB(item);
  item.id = id;
  state.items.push(item);
  state.totalScans++;
  _pushUndo({ id, displayName: values.accession_number || values.slide_number || 'Unknown' });
  await persistSession();
  showScreen('histology-scan');
}

function _findConflict(type, values) {
  const keys = CONFLICT_KEYS[type];
  if (!keys) return null;
  return state.items.find(item =>
    item.type === type &&
    keys.every(k => values[k] && item.fields[k] && item.fields[k] === values[k])
  ) || null;
}

// ===== CONFLICT VIEW =====
function _renderConflictView() {
  const { existing, incoming } = state.pendingConflict || {};
  if (!existing || !incoming) return;
  const fields = FIELDS[state.sessionType] || [];

  const render = data => fields.slice(0, 4).map(f => `
    <div class="conflict-row">
      <strong>${esc(f.label)}</strong>
      ${esc((typeof data === 'object' && !data.fields ? data : data.fields)?.[f.key] || '—')}
    </div>`).join('');

  document.getElementById('conflictExisting').innerHTML = render(existing);
  document.getElementById('conflictNew').innerHTML      = render(incoming);
}

// ===== REVIEW QUEUE =====
function addToReviewQueue(values, reason) {
  state.reviewQueue.push({ type: state.sessionType, fields: values, reason, addedAt: Date.now() });
  persistSession();
  updateReviewBadges();
}

function updateReviewBadges() {
  const count = state.reviewQueue.length;
  const text  = count > 0 ? String(count) : '0';
  ['reviewBadge1','reviewBadge2','reviewBadge3','reviewBadge4','reviewBadge5','reviewQueueBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = text; el.dataset.count = text; }
  });
}

function renderReviewQueue() {
  const list  = document.getElementById('reviewList');
  const empty = document.getElementById('reviewEmpty');
  const queue = state.reviewQueue;

  if (!queue.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  list.innerHTML = queue.map((item, i) => {
    const fields    = FIELDS[item.type] || [];
    const nameField = fields.find(f => f.required) || fields[0];
    const name      = item.fields?.[nameField?.key] || 'Unnamed item';
    return `<li class="review-item">
      <div class="review-item__header">
        <span class="review-item__name">${esc(name)}</span>
        <span class="type-badge type-badge--${item.reason || 'uncertain'}">${item.reason || 'uncertain'}</span>
      </div>
      <p class="review-item__meta">${esc(SESSION_LABELS[item.type] || item.type)}</p>
      <div class="review-item__actions">
        <button class="btn btn--primary" onclick="resolveReviewItem(${i},'add')">Add</button>
        <button class="btn btn--ghost"   onclick="resolveReviewItem(${i},'drop')">Drop</button>
      </div>
    </li>`;
  }).join('');
}

async function resolveReviewItem(index, action) {
  const item = state.reviewQueue[index];
  if (!item) return;
  if (action === 'add') {
    const dbItem = { type: item.type, sessionId: state.sessionId, fields: item.fields, status: 'corrected' };
    const id = await addItemToDB(dbItem);
    dbItem.id = id;
    state.items.push(dbItem);
    state.totalScans++;
  }
  state.reviewQueue.splice(index, 1);
  await persistSession();
  updateReviewBadges();
  renderReviewQueue();
}

// ===== UNDO STRIP =====
function _pushUndo(scan) {
  state.lastScans.unshift(scan);
  if (state.lastScans.length > 5) state.lastScans.pop();
  renderUndoStrip();
  renderLastScanned();
  if (state.sessionType === 'box')       _updateBoxStatus();
  if (state.sessionType === 'antibody')  { const el = document.getElementById('abTotal');   if (el) el.textContent = `${state.totalScans} scans`; }
  if (state.sessionType === 'histology') { const el = document.getElementById('histTotal'); if (el) el.textContent = `${state.totalScans} scans`; }
  _checkScanCap();
}

function renderUndoStrip() {
  const ids = { antibody: 'abUndoStrip', box: 'boxUndoStrip', histology: 'histUndoStrip' };
  const strip = document.getElementById(ids[state.sessionType]);
  if (!strip) return;
  strip.innerHTML = state.lastScans.map(s =>
    `<div class="undo-chip">
      <span>${esc(s.displayName)}</span>
      <button class="undo-chip__x" onclick="undoScan(${s.id})">×</button>
    </div>`).join('');
}

async function undoScan(itemId) {
  if (!confirm('Remove this scan?')) return;
  const idx = state.items.findIndex(i => i.id === itemId);
  if (idx !== -1) {
    const item = state.items[idx];
    if (item.position) {
      delete state.currentBox.positions[item.position];
      if (state.currentBox.posIndex > 0) state.currentBox.posIndex--;
    }
    state.items.splice(idx, 1);
    await deleteItemFromDB(itemId);
    if (state.totalScans > 0) state.totalScans--;
  }
  state.lastScans = state.lastScans.filter(s => s.id !== itemId);
  await persistSession();
  renderUndoStrip();
  renderLastScanned();
  if (state.sessionType === 'box') _updateBoxStatus();
}

function renderLastScanned() {
  const ids = { antibody: 'abLastScannedList', box: 'boxLastScannedList', histology: 'histLastScannedList' };
  const list = document.getElementById(ids[state.sessionType]);
  if (!list) return;
  const showPos = state.sessionType === 'box';
  list.innerHTML = state.lastScans.slice(0, 8).map(s =>
    `<li class="last-scanned__item">
      ${showPos && s.position ? `<span class="last-scanned__pos">${esc(s.position)}</span>` : ''}
      <span class="last-scanned__name">${esc(s.displayName)}</span>
    </li>`).join('');
}

// ===== END BOX =====
function renderEndBox() {
  const boxItems = state.items.filter(i => i.boxNumber === state.currentBox.number);
  document.getElementById('endBoxMeta').textContent =
    `${boxItems.length} item${boxItems.length !== 1 ? 's' : ''} logged in Box ${state.currentBox.number || '—'}`;
}

function startNextBox() {
  state.currentBox = { number: '', label: '', size: null, posIndex: 0, positions: {} };
  state.lastScans  = [];
  showScreen('box-setup');
}

async function finishSession() {
  await clearSession();
  Object.assign(state, {
    sessionType: null, sessionId: null, totalScans: 0,
    items: [], reviewQueue: [], lastScans: [],
    currentBox: { number: '', label: '', size: null, posIndex: 0, positions: {} },
  });
  showScreen('home');
}

// ===== SHEET VIEW =====
function renderSheetView() {
  const fields  = FIELDS[state.sessionType] || [];
  const search  = (document.getElementById('sheetSearch')?.value || '').toLowerCase();
  const visible = search
    ? state.items.filter(i => Object.values(i.fields || {}).some(v => String(v).toLowerCase().includes(search)))
    : state.items;

  const extraH = state.sessionType === 'box' ? ['Box','Pos'] : [];
  const headers = [...extraH, ...fields.map(f => f.label)];
  document.getElementById('sheetHead').innerHTML =
    `<tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;

  document.getElementById('sheetBody').innerHTML = visible.map(item => {
    const cls   = item.status === 'corrected' ? 'row--corrected' : 'row--auto';
    const extra = state.sessionType === 'box'
      ? `<td>${esc(item.boxNumber||'')}</td><td>${esc(item.position||'')}</td>` : '';
    const cells = fields.map(f => `<td title="${esc(item.fields?.[f.key]||'')}">${esc(item.fields?.[f.key]||'')}</td>`).join('');
    return `<tr class="${cls}">${extra}${cells}</tr>`;
  }).join('');

  const dlBtn = document.getElementById('downloadBtn');
  dlBtn.disabled = state.reviewQueue.length > 0;
  dlBtn.title    = state.reviewQueue.length > 0 ? 'Clear review queue before downloading' : '';
}

// ===== COLUMN MAPPING =====
function buildMappingTable(headers, sessionType) {
  const fields = FIELDS[sessionType] || [];
  const opts   = fields.map(f => `<option value="${f.key}">${esc(f.label)}</option>`).join('') +
                 '<option value="">— Skip —</option>';

  document.getElementById('mappingTableBody').innerHTML = headers.map((h, i) => {
    const guess = guessFieldFromHeader(h, sessionType);
    return `<tr>
      <td>${esc(h)}</td>
      <td><select class="input map-select" data-col="${i}" style="min-height:36px;padding:4px 8px;font-size:.82rem">
        ${fields.map(f => `<option value="${f.key}" ${f.key===guess?'selected':''}>${esc(f.label)}</option>`).join('')}
        <option value="" ${!guess?'selected':''}>— Skip —</option>
      </select></td>
      <td class="match-icon">${guess ? '✅' : '⚠️'}</td>
    </tr>`;
  }).join('');

  document.querySelectorAll('.map-select').forEach(sel =>
    sel.addEventListener('change', () => {
      sel.closest('tr').querySelector('.match-icon').textContent = sel.value ? '✅' : '⚠️';
    })
  );
}

function buildPreviewTable(headers, rows) {
  const preview = rows.slice(0, 3);
  document.getElementById('previewTableWrapper').innerHTML =
    `<table class="map-table">
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${preview.map(row => `<tr>${headers.map((_,i) => `<td>${esc(String(row[i]??''))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

function importMappedData() {
  const sessionType = document.getElementById('mappingSessionType').value;
  if (!sessionType) { alert('Select a session type first.'); return; }

  const mapping = {};
  document.querySelectorAll('.map-select').forEach(sel => {
    if (sel.value) mapping[parseInt(sel.dataset.col)] = sel.value;
  });

  state.sessionType = sessionType;
  state.sessionId   = state.sessionId || Date.now().toString();

  Promise.all(state.uploadedRows.map(row => {
    const fields = {};
    Object.entries(mapping).forEach(([col, key]) => { fields[key] = String(row[col] ?? '').trim(); });
    const item = { type: sessionType, sessionId: state.sessionId, fields, status: 'auto' };
    return addItemToDB(item).then(id => { item.id = id; state.items.push(item); state.totalScans++; });
  })).then(() => {
    persistSession();
    showScreen(sessionType === 'box' ? 'box-setup' : SCAN_SCREENS[sessionType]);
  });
}

// ===== LOADING =====
function showLoading(msg) {
  document.getElementById('loadingMsg').textContent = msg || 'Loading…';
  document.getElementById('loadingOverlay').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

// ===== UTILITY =====
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== EVENT BINDING =====
function bindEvents() {
  // Global back-button delegation
  document.addEventListener('click', e => { if (e.target.closest('[data-back]')) goBack(); });

  // Settings drawer
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('apiKeyInput').value = localStorage.getItem('anthropic_api_key') || '';
    document.getElementById('settingsDrawer').classList.remove('hidden');
  });
  ['settingsBackdrop','closeSettingsBtn'].forEach(id =>
    document.getElementById(id).addEventListener('click', () =>
      document.getElementById('settingsDrawer').classList.add('hidden')
    )
  );
  document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
    const k = document.getElementById('apiKeyInput').value.trim();
    if (k) localStorage.setItem('anthropic_api_key', k);
    document.getElementById('settingsDrawer').classList.add('hidden');
  });

  // Session type buttons
  document.getElementById('startAntibodyBtn').addEventListener('click', () => startSession('antibody'));
  document.getElementById('startBoxBtn').addEventListener('click',      () => startSession('box'));
  document.getElementById('startHistologyBtn').addEventListener('click',() => startSession('histology'));

  // Resume / discard
  document.getElementById('resumeBtn').addEventListener('click',  resumeSessionFromDB);
  document.getElementById('discardBtn').addEventListener('click', discardSessionFromDB);

  // Upload Excel
  document.getElementById('uploadExcelBtn').addEventListener('click', () =>
    document.getElementById('excelFileInput').click()
  );
  document.getElementById('excelFileInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    showLoading('Reading file…');
    try {
      const { headers, rows } = await readExcelFile(file);
      hideLoading();
      state.uploadedHeaders = headers;
      state.uploadedRows    = rows;
      document.getElementById('uploadedFileName').textContent = file.name;
      document.getElementById('mappingTableBody').innerHTML    = '';
      document.getElementById('previewTableWrapper').innerHTML = '';
      document.getElementById('mappingSessionType').value      = '';
      showScreen('column-mapping');
    } catch (err) {
      hideLoading();
      alert('Could not read file: ' + err.message);
    }
  });

  // Column mapping
  document.getElementById('mappingSessionType').addEventListener('change', e => {
    const type = e.target.value;
    if (type && state.uploadedHeaders.length) {
      buildMappingTable(state.uploadedHeaders, type);
      buildPreviewTable(state.uploadedHeaders, state.uploadedRows);
    }
  });
  document.getElementById('confirmMappingBtn').addEventListener('click', importMappedData);

  // Box setup
  document.getElementById('boxNumber').addEventListener('input', validateBoxSetup);
  document.getElementById('boxLabel').addEventListener('input',  e => { state.currentBox.label = e.target.value.trim(); });
  document.querySelectorAll('.size-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('size-btn--active'));
      btn.classList.add('size-btn--active');
      state.currentBox.size = btn.dataset.size;
      document.getElementById('gridHint').classList.remove('hidden');
      renderBoxGrid();
      validateBoxSetup();
    })
  );
  document.getElementById('startBoxScanBtn').addEventListener('click', () => {
    state.currentBox.number = document.getElementById('boxNumber').value.trim();
    state.currentBox.label  = document.getElementById('boxLabel').value.trim();
    showScreen('box-scan');
  });

  // Box scan
  document.getElementById('boxReadBtn').addEventListener('click', () => handleReadLabel('box'));
  document.getElementById('boxTypeBtn').addEventListener('click', () => showManualEntry('Enter box item details manually.'));
  document.getElementById('endBoxBtn').addEventListener('click',  () => showScreen('end-box'));

  // Box result (also handles antibody result, same screen)
  document.getElementById('boxResultBackBtn').addEventListener('click', showScanScreen);
  document.getElementById('boxConfirmBtn').addEventListener('click', async () => {
    const values = collectResultValues(document.getElementById('boxResultCard'));
    if (state.sessionType === 'box')      await confirmBoxScan(values);
    else if (state.sessionType === 'antibody') await confirmAntibodyScan(values);
  });
  document.getElementById('boxReviewLaterBtn').addEventListener('click', () => {
    const card   = document.getElementById('boxResultCard');
    const values = collectResultValues(card);
    const reason = card.querySelector('.field-row--unreadable') ? 'unreadable'
                 : card.querySelector('.field-row--uncertain')  ? 'uncertain' : 'pending';
    addToReviewQueue(values, reason);
    showScanScreen();
  });

  // Antibody scan
  document.getElementById('abReadBtn').addEventListener('click', () => handleReadLabel('antibody'));
  document.getElementById('abTypeBtn').addEventListener('click', () => showManualEntry('Enter antibody details manually.'));

  // Antibody conflict
  document.getElementById('conflictKeepBtn').addEventListener('click', () => {
    state.pendingConflict = null;
    showScreen('antibody-scan');
  });
  document.getElementById('conflictUpdateBtn').addEventListener('click', async () => {
    const { existing, incoming } = state.pendingConflict || {};
    if (existing && incoming) {
      const updated = { ...existing, fields: { ...existing.fields, ...incoming }, status: 'corrected' };
      await updateItemInDB(updated);
      const idx = state.items.findIndex(i => i.id === existing.id);
      if (idx !== -1) state.items[idx] = updated;
      await persistSession();
    }
    state.pendingConflict = null;
    showScreen('antibody-scan');
  });
  document.getElementById('conflictAddNewBtn').addEventListener('click', async () => {
    const { incoming } = state.pendingConflict || {};
    if (incoming) {
      const item = { type: 'antibody', sessionId: state.sessionId, fields: incoming, status: 'auto' };
      const id   = await addItemToDB(item);
      item.id    = id;
      state.items.push(item);
      state.totalScans++;
      _pushUndo({ id, displayName: incoming.catalog_number || 'Unknown' });
      await persistSession();
    }
    state.pendingConflict = null;
    showScreen('antibody-scan');
  });
  document.getElementById('conflictReviewBtn').addEventListener('click', () => {
    const { incoming } = state.pendingConflict || {};
    if (incoming) addToReviewQueue(incoming, 'conflict');
    state.pendingConflict = null;
    showScreen('antibody-scan');
  });

  // Histology scan
  document.getElementById('histReadBtn').addEventListener('click', () => handleReadLabel('histology'));
  document.getElementById('histTypeBtn').addEventListener('click', () => showManualEntry('Enter histology slide details manually.'));

  // Histology result
  document.getElementById('histResultBackBtn').addEventListener('click', showScanScreen);
  document.getElementById('histConfirmBtn').addEventListener('click', async () => {
    const values = collectResultValues(document.getElementById('histResultCard'));
    await confirmHistologyScan(values);
  });
  document.getElementById('histReviewLaterBtn').addEventListener('click', () => {
    const card   = document.getElementById('histResultCard');
    const values = collectResultValues(card);
    const reason = card.querySelector('.field-row--unreadable') ? 'unreadable' : 'uncertain';
    addToReviewQueue(values, reason);
    showScreen('histology-scan');
  });

  // Manual entry
  document.getElementById('manualSubmitBtn').addEventListener('click', async () => {
    const values = {};
    document.getElementById('manualFormFields').querySelectorAll('input').forEach(i => { values[i.name] = i.value.trim(); });
    const req = (FIELDS[state.sessionType] || []).find(f => f.required);
    if (req && !values[req.key]) { alert(`${req.label} is required.`); return; }
    if (state.sessionType === 'box')           await confirmBoxScan(values);
    else if (state.sessionType === 'antibody') await confirmAntibodyScan(values);
    else if (state.sessionType === 'histology')await confirmHistologyScan(values);
  });

  // Review queue
  document.getElementById('reviewBackBtn').addEventListener('click', goBack);

  // End box
  document.getElementById('nextBoxBtn').addEventListener('click',     startNextBox);
  document.getElementById('finishSessionBtn').addEventListener('click', finishSession);
  document.getElementById('keepScanningBtn').addEventListener('click', () => showScreen('box-scan'));

  // Sheet view
  document.getElementById('sheetSearch').addEventListener('input', renderSheetView);
  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (state.reviewQueue.length) { alert('Clear the review queue before downloading.'); return; }
    const name = prompt('Filename:', `lab-stock-${new Date().toISOString().slice(0,10)}.xlsx`);
    if (name !== null) exportToExcel(state.items, state.sessionType, name);
  });

  // Camera controls
  document.getElementById('flashBtn').addEventListener('click', toggleTorch);
  document.getElementById('focusBtn').addEventListener('click', triggerFocus);
}

// ===== INIT =====
async function init() {
  await openDB();
  bindEvents();
  initHome();
  updateReviewBadges();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
