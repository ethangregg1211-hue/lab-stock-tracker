// ===== FIELD DEFINITIONS =====
const FIELDS = {
  antibody: [
    { key: 'catalog_number', label: 'Catalog #',        required: true },
    { key: 'lot_number',     label: 'Lot #' },
    { key: 'target',         label: 'Target / Antigen' },
    { key: 'host_species',   label: 'Host species' },
    { key: 'clone',          label: 'Clone' },
    { key: 'concentration',  label: 'Concentration' },
    { key: 'expiry',         label: 'Expiry date',      type: 'date' },
    { key: 'storage',        label: 'Storage condition' },
  ],
  histology: [
    { key: 'study_id',       label: 'Study ID',         required: true },
    { key: 'mouse_id',       label: 'Mouse ID' },
    { key: 'tissue',         label: 'Tissue' },
    { key: 'stain',          label: 'Stain' },
    { key: 'slide_no',       label: 'Slide no.' },
    { key: 'block_no',       label: 'Block no.' },
    { key: 'fix',            label: 'Fix' },
    { key: 'initials',       label: 'Initials' },
    { key: 'date',           label: 'Date',             type: 'date' },
    { key: 'treatment',      label: 'Treatment' },
    { key: 'group',          label: 'Group' },
    { key: 'accession_no',   label: 'Accession no.' },
    { key: 'experiment_id',  label: 'Experiment ID' },
  ],
  chemical: [
    { key: 'chemical_description', label: 'Chemical Name',        required: true },
    { key: 'cas_num',              label: 'CAS #' },
    { key: 'catalog_number',       label: 'Catalog #' },
    { key: 'vendor',               label: 'Vendor' },
    { key: 'physical_state',       label: 'Physical State' },
    { key: 'lot_number',           label: 'Lot #' },
    { key: 'concentration',        label: 'Concentration' },
    { key: 'receipt_quantity',     label: '# of Containers' },
    { key: 'unit',                 label: 'Amount per Container' },
    { key: 'chemical_unit',        label: 'Unit of Measure' },
    { key: 'receipt_date',         label: 'Receipt Date',         type: 'date' },
    { key: 'storage_location',     label: 'Storage Location' },
    { key: 'storage_device',       label: 'Storage Device' },
  ],
};

const SESSION_LABELS = {
  antibody:  'Antibody stocks',
  histology: 'Histology',
  chemical:  'Chemical inventory',
};

const SCAN_SCREENS = {
  antibody:  'antibody-scan',
  histology: 'histology-scan',
  chemical:  'chemical-scan',
};

const CONFLICT_KEYS = {
  antibody:  ['catalog_number', 'lot_number'],
  histology: ['study_id', 'mouse_id'],
};

const SCAN_FIELD_OVERRIDES = {
  chemical: ['chemical_description','catalog_number','lot_number','vendor','physical_state','cas_num'],
};

// Internal field-name values that appear in row 2 of the university import template.
// Any imported row whose chemical_description matches one of these is the header row
// and must be filtered out of the display and export.
const CHEM_INTERNAL_FIELD_NAMES = new Set([
  'researcher','last_name','first_name','building','lab',
  'storage_location','sub_storage_location','storage_requirements','storage_device',
  'chemical_description','physical_state','receipt_quantity','unit','chemical_unit',
  'cas_num','chemical_formula','molecular_weight','vendor','catalog_number','po_number',
  'receipt_date','open_date','max_on_hand','expiration_date','contact','comments',
  'date_entered','ship_code','last_updated','concentration',
  'chemical_number','lot_number','multiple_cas','msds_url','order_date','will_expire',
]);


const TISSUE_PRESETS = [
  'tumor','mammary gland','cancer','GU','MG','RMG','LMG',
  'bone','bones','tibia','femur','leg','legs','muscle',
  'uterus','kidney','spleen','liver','lung','intestine',
  'lymph node','brain','skin','ovary',
];

// Template standard field palette
const TEMPLATE_FIELDS = [
  { key: 'mouse_id',      label: 'Mouse ID' },
  { key: 'tissue',        label: 'Tissue' },
  { key: 'stain',         label: 'Stain' },
  { key: 'slide_no',      label: 'Slide no.' },
  { key: 'block_no',      label: 'Block no.' },
  { key: 'fix',           label: 'Fix' },
  { key: 'initials',      label: 'Initials' },
  { key: 'date',          label: 'Date' },
  { key: 'treatment',     label: 'Treatment' },
  { key: 'group',         label: 'Group' },
  { key: 'accession_no',  label: 'Accession no.' },
  { key: 'experiment_id', label: 'Experiment ID' },
];

const DEFAULT_TEMPLATES = [
  {
    id: 'default-1',
    name: 'Jaime H and E',
    rows: [
      { name: 'Top row',    fields: ['mouse_id'] },
      { name: 'Middle row', fields: ['tissue', 'stain'] },
      { name: 'Bottom row', fields: ['initials', 'date'] },
    ],
    customFields: [],
  },
  {
    id: 'default-2',
    name: 'Histology core format',
    rows: [
      { name: 'Top row',    fields: ['mouse_id', 'slide_no'] },
      { name: 'Middle row', fields: ['tissue', 'stain'] },
      { name: 'Bottom row', fields: [] },
    ],
    customFields: [],
  },
];

function scanFieldsFor(type) {
  if (type === 'histology' && state.activeTemplate) {
    const rows = state.activeTemplate.rows || [];
    const templateKeys = new Set(['study_id', ...rows.flatMap(r => r.fields || [])]);
    const customKeys = new Set((state.activeTemplate.customFields || []).map(f => f.key));
    return [
      ...(FIELDS.histology || []).filter(f => templateKeys.has(f.key)),
      ...(state.activeTemplate.customFields || []).filter(f => customKeys.has(f.key)),
    ];
  }
  const override = SCAN_FIELD_OVERRIDES[type];
  if (!override) return FIELDS[type] || [];
  return (FIELDS[type] || []).filter(f => override.includes(f.key));
}

// ===== TEMPLATE STORAGE =====
function _getTemplates() {
  try {
    const stored = JSON.parse(localStorage.getItem('labscan_templates') || 'null');
    if (!stored || !stored.length) {
      localStorage.setItem('labscan_templates', JSON.stringify(DEFAULT_TEMPLATES));
      return JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    }
    return stored;
  } catch { return JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)); }
}

function _saveTemplates(templates) {
  localStorage.setItem('labscan_templates', JSON.stringify(templates));
}

function _getAllTemplateFields(template) {
  return [
    ...TEMPLATE_FIELDS,
    ...(template?.customFields || []),
  ];
}

// ===== STATE =====
const state = {
  screen: 'home',
  sessionType: null,
  sessionId: null,
  totalScans: 0,
  items: [],
  reviewQueue: [],
  currentStudy: null,
  histologyMode: 'slides',
  activeTemplate: null,
  chemRemovalStaging: {},
  lastScans: [],
  pendingResult: null,
  pendingScan1: null,
  pendingConflict: null,
  uploadedHeaders: [],
  uploadedRows: [],
  uploadedFileName: '',
  uploadedColMapping: {},      // colIndex → fieldKey, built during import
  uploadedFieldNamesRow: null, // raw row 2 of the university template (preserved for export)
  pendingChemFrontScan: null,  // front-photo result when in front/back scan mode
  pendingChemMatch: null,
};

// ===== TEMPLATE DESIGNER STATE =====
let _designer = {
  template: null,
  selectedKey: null,
};

function _freshDesignerTemplate() {
  return {
    id: null,
    name: '',
    rows: [
      { name: 'Top row',    fields: [] },
      { name: 'Middle row', fields: [] },
      { name: 'Bottom row', fields: [] },
    ],
    customFields: [],
  };
}

// ===== NAVIGATION =====
const navStack = [];

function showScreen(id, pushHistory = true) {
  if (id === state.screen) return;

  const leavingScan  = ['antibody-scan','histology-scan','chemical-scan'].includes(state.screen);
  const enteringScan = ['antibody-scan','histology-scan','chemical-scan'].includes(id);
  if (leavingScan && !enteringScan) stopCamera();

  if (pushHistory) navStack.push(state.screen);
  state.screen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');

  updateReviewBadges();
  _onEnter(id);
}

function goBack() {
  const prev = navStack.length > 0 ? navStack.pop() : 'home';
  showScreen(prev, false);
}

function goHome() {
  if (['antibody-scan','histology-scan','chemical-scan'].includes(state.screen)) stopCamera();
  navStack.length = 0;
  const prev = state.screen;
  state.screen = '';
  showScreen('home', false);
}

function showScanScreen(pushHistory = true) {
  if (!state.sessionType) { showScreen('home', pushHistory); return; }
  if (state.sessionType === 'histology' && (!state.currentStudy || !state.activeTemplate)) {
    showScreen('histology-setup', pushHistory);
    return;
  }
  showScreen(SCAN_SCREENS[state.sessionType], pushHistory);
}

function _onEnter(id) {
  const inits = {
    'home':                  initHome,
    'histology-setup':       initHistologySetup,
    'session-preview':       initSessionPreview,
    'template-library':      initTemplateLibrary,
    'template-designer':     initTemplateDesigner,
    'antibody-scan':         initAntibodyScan,
    'histology-scan':        initHistologyScan,
    'chemical-scan':         initChemicalScan,
    'chemical-new-details':  initChemicalNewDetails,
    'chemical-reconcile':    renderChemicalReconcile,
    'review-queue':          renderReviewQueue,
    'sheet-view':            renderSheetView,
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
  updateHomeUploadCard();
}

function updateHomeUploadCard() {
  const hasFile  = state.uploadedHeaders.length > 0;
  const emptyEl   = document.getElementById('uploadEmptyState');
  const loadedEl  = document.getElementById('uploadLoadedState');
  const fileNameEl = document.getElementById('uploadedFileNameHome');

  if (hasFile) {
    if (emptyEl)    emptyEl.classList.add('hidden');
    if (loadedEl)   loadedEl.classList.remove('hidden');
    if (fileNameEl) fileNameEl.textContent = state.uploadedFileName || 'File loaded';
  } else {
    if (emptyEl)    emptyEl.classList.remove('hidden');
    if (loadedEl)   loadedEl.classList.add('hidden');
  }

  ['startAntibodyBtn', 'startHistologyBtn', 'startChemicalBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !hasFile;
  });
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
    pendingScan1: null,
    pendingConflict: null,
    pendingChemMatch: null,
    currentStudy: null,
    histologyMode: 'slides',
    activeTemplate: null,
    chemRemovalStaging: {},
  });
  if (type === 'histology') {
    showScreen('histology-setup');
  } else if (type === 'chemical') {
    if (state.uploadedRows.length > 0) {
      _importChemicalsFromSheet();
    } else {
      showScreen('chemical-scan');
    }
  } else {
    showScreen(SCAN_SCREENS[type]);
  }
}

async function resumeSessionFromDB() {
  const session = await loadSession();
  if (!session) return;
  Object.assign(state, {
    sessionType:           session.sessionType,
    sessionId:             session.sessionId,
    totalScans:            session.totalScans           || 0,
    items:                 session.items                || [],
    reviewQueue:           session.reviewQueue          || [],
    lastScans:             session.lastScans            || [],
    currentStudy:          session.currentStudy         || null,
    histologyMode:         session.histologyMode        || 'slides',
    activeTemplate:        session.activeTemplate       || null,
    chemRemovalStaging:    session.chemRemovalStaging   || {},
    uploadedHeaders:       session.uploadedHeaders      || [],
    uploadedColMapping:    session.uploadedColMapping   || {},
    uploadedFieldNamesRow: session.uploadedFieldNamesRow || null,
  });
  document.getElementById('resumeCard').classList.add('hidden');
  showScanScreen(false);
}

async function discardSessionFromDB() {
  await clearSession();
  document.getElementById('resumeCard').classList.add('hidden');
}

async function persistSession() {
  try {
    await saveSession({
      sessionType:           state.sessionType,
      sessionId:             state.sessionId,
      totalScans:            state.totalScans,
      items:                 state.items,
      reviewQueue:           state.reviewQueue,
      lastScans:             state.lastScans,
      currentStudy:          state.currentStudy,
      histologyMode:         state.histologyMode,
      activeTemplate:        state.activeTemplate,
      chemRemovalStaging:    state.chemRemovalStaging,
      uploadedHeaders:       state.uploadedHeaders,
      uploadedColMapping:    state.uploadedColMapping,
      uploadedFieldNamesRow: state.uploadedFieldNamesRow,
    });
  } catch (e) {
    console.warn('Session save failed', e);
  }
}

async function finishSession() {
  await clearSession();
  navStack.length = 0;
  Object.assign(state, {
    sessionType: null, sessionId: null, totalScans: 0,
    items: [], reviewQueue: [], lastScans: [],
    pendingScan1: null, pendingChemFrontScan: null, currentStudy: null,
    histologyMode: 'slides', activeTemplate: null,
    chemRemovalStaging: {},
  });
  showScreen('home', false);
}

// ===== HISTOLOGY SETUP =====
function _getRecentStudyIDs() {
  try { return JSON.parse(localStorage.getItem('labscan_recent_study_ids') || '[]'); }
  catch { return []; }
}

function _addRecentStudyID(id) {
  const list = _getRecentStudyIDs().filter(s => s !== id);
  list.unshift(id);
  localStorage.setItem('labscan_recent_study_ids', JSON.stringify(list.slice(0, 5)));
}

function initHistologySetup() {
  const input = document.getElementById('histStudyIdInput');
  if (input) input.value = state.currentStudy || '';

  // Recent study IDs
  const recent  = _getRecentStudyIDs();
  const section = document.getElementById('recentStudyIdsSection');
  const chips   = document.getElementById('recentStudyIdChips');
  if (section && chips) {
    if (recent.length) {
      section.classList.remove('hidden');
      chips.innerHTML = recent.map(s => `<button class="recent-chip" type="button">${esc(s)}</button>`).join('');
      chips.querySelectorAll('.recent-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          if (input) { input.value = chip.textContent; _validateHistologySetup(); }
        });
      });
    } else {
      section.classList.add('hidden');
    }
  }

  // Template picker
  _populateTemplateSelect('histTemplateSelect');

  // Mode toggle
  const toggle = document.getElementById('histModeSelect');
  if (toggle) toggle.value = state.histologyMode || 'slides';

  _validateHistologySetup();
}

function _populateTemplateSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const templates = _getTemplates();
  sel.innerHTML = '<option value="">Select a template...</option>' +
    templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  const lastId = localStorage.getItem('labscan_last_template');
  if (lastId) sel.value = lastId;
}

function _validateHistologySetup() {
  const study    = document.getElementById('histStudyIdInput')?.value.trim();
  const template = document.getElementById('histTemplateSelect')?.value;
  const btn      = document.getElementById('continueHistologyBtn');
  if (btn) btn.disabled = !(study && template);
}

function continueToPreview() {
  const studyId    = document.getElementById('histStudyIdInput')?.value.trim();
  const templateId = document.getElementById('histTemplateSelect')?.value;
  const mode       = document.getElementById('histModeSelect')?.value || 'slides';

  if (!studyId || !templateId) return;

  state.currentStudy   = studyId;
  state.histologyMode  = mode;
  const templates      = _getTemplates();
  state.activeTemplate = templates.find(t => t.id === templateId) || null;

  _addRecentStudyID(studyId);
  localStorage.setItem('labscan_last_template', templateId);

  showScreen('session-preview');
}

// ===== SESSION PREVIEW =====
function initSessionPreview() {
  const studyEl = document.getElementById('previewStudyId');
  if (studyEl) studyEl.textContent = state.currentStudy || '';

  const tmplEl = document.getElementById('previewTemplateName');
  if (tmplEl) tmplEl.textContent = state.activeTemplate?.name || 'No template';

  const modeEl = document.getElementById('previewMode');
  if (modeEl) modeEl.textContent = state.histologyMode === 'slides' ? 'Slides' : 'Blocks';

  renderTemplatePreview(document.getElementById('previewTemplateViz'), state.activeTemplate);
}

function renderTemplatePreview(container, template) {
  if (!container) return;
  if (!template) { container.innerHTML = '<p class="muted-text" style="text-align:center;padding:16px">No template selected.</p>'; return; }

  const allFields = _getAllTemplateFields(template);

  container.innerHTML = `<div class="slide-preview">` +
    template.rows.map(row => {
      if (!row.fields.length) return '';
      const chips = row.fields.map(key => {
        const f = allFields.find(x => x.key === key) || { label: key };
        return `<span class="preview-field-chip">${esc(f.label)}</span>`;
      }).join('');
      return `<div class="preview-row">${chips}</div>`;
    }).filter(Boolean).join('') +
    `</div>`;

  if (!template.rows.some(r => r.fields.length)) {
    container.innerHTML = '<p class="muted-text" style="text-align:center;padding:16px">No fields placed in this template.</p>';
  }
}

// ===== TEMPLATE LIBRARY =====
function initTemplateLibrary() {
  const list = document.getElementById('templateLibraryList');
  if (!list) return;
  const templates = _getTemplates();

  if (!templates.length) {
    list.innerHTML = '<li class="muted-text" style="padding:16px 0">No templates yet.</li>';
    return;
  }

  list.innerHTML = templates.map(t => {
    const allFields = _getAllTemplateFields(t);
    const fieldLabels = t.rows.flatMap(r => r.fields).map(key => {
      const f = allFields.find(x => x.key === key);
      return f ? f.label : key;
    });
    const summary = fieldLabels.join(', ') || 'No fields placed';
    return `<li class="template-list-item" onclick="openTemplateEditor('${esc(t.id)}')">
      <div class="template-list-item__name">${esc(t.name)}</div>
      <div class="template-list-item__summary">${esc(summary)}</div>
      <i class="ti ti-chevron-right template-list-item__arrow"></i>
    </li>`;
  }).join('');
}

function openTemplateEditor(templateId) {
  const templates = _getTemplates();
  const template  = templates.find(t => t.id === templateId);
  if (!template) return;
  _designer.template    = JSON.parse(JSON.stringify(template));
  _designer.selectedKey = null;
  showScreen('template-designer');
}

function newTemplate() {
  _designer.template    = _freshDesignerTemplate();
  _designer.selectedKey = null;
  showScreen('template-designer');
}

function deleteCurrentTemplate() {
  const id = _designer.template?.id;
  if (!id) { goBack(); return; }
  if (!confirm('Delete this template?')) return;
  const templates = _getTemplates().filter(t => t.id !== id);
  _saveTemplates(templates);
  goBack();
}

// ===== TEMPLATE DESIGNER =====
function initTemplateDesigner() {
  if (!_designer.template) _designer.template = _freshDesignerTemplate();
  const nameInput = document.getElementById('templateNameInput');
  if (nameInput) nameInput.value = _designer.template.name || '';
  _designer.selectedKey = null;
  renderDesignerPalette();
  renderDesignerRows();
}

function renderDesignerPalette() {
  const t = _designer.template;
  if (!t) return;
  const placed     = new Set(t.rows.flatMap(r => r.fields));
  const customKeys = (t.customFields || []).map(f => f.key);

  const stdEl  = document.getElementById('standardPalette');
  const custEl = document.getElementById('customPalette');

  if (stdEl) {
    stdEl.innerHTML = TEMPLATE_FIELDS
      .filter(f => !placed.has(f.key))
      .map(f => {
        const sel = _designer.selectedKey === f.key ? ' palette-chip--selected' : '';
        return `<button class="palette-chip${sel}" onclick="_selectPaletteField('${f.key}')">${esc(f.label)}</button>`;
      }).join('') || '<span class="muted-text" style="font-size:12px">All fields placed</span>';
  }

  if (custEl) {
    custEl.innerHTML = (t.customFields || [])
      .filter(f => !placed.has(f.key))
      .map(f => {
        const sel = _designer.selectedKey === f.key ? ' palette-chip--selected palette-chip--custom' : ' palette-chip--custom';
        return `<button class="palette-chip${sel}" onclick="_selectPaletteField('${f.key}')">${esc(f.label)}</button>`;
      }).join('') || '';
  }
}

function renderDesignerRows() {
  const t = _designer.template;
  if (!t) return;
  const allFields = _getAllTemplateFields(t);

  t.rows.forEach((row, ri) => {
    const zones = document.getElementById(`designerRowZones${ri}`);
    const count = document.getElementById(`designerRowCount${ri}`);
    if (!zones) return;

    if (count) count.textContent = `${row.fields.length}/3`;

    let html = row.fields.map((key, fi) => {
      const f = allFields.find(x => x.key === key) || { label: key };
      return `<button class="slide-zone slide-zone--filled" onclick="_removeFieldFromZone(${ri},${fi})">${esc(f.label)}</button>`;
    }).join('');

    if (row.fields.length < 3) {
      const accepting = _designer.selectedKey ? ' slide-zone--accepting' : '';
      html += `<button class="slide-zone slide-zone--empty${accepting}" onclick="_placeFieldInZone(${ri})">${_designer.selectedKey ? '+ Place here' : 'Empty'}</button>`;
    }

    zones.innerHTML = html;
  });
}

function _selectPaletteField(key) {
  _designer.selectedKey = _designer.selectedKey === key ? null : key;
  renderDesignerPalette();
  renderDesignerRows();
}

function _placeFieldInZone(rowIndex) {
  if (!_designer.selectedKey) return;
  const row = _designer.template.rows[rowIndex];
  if (!row || row.fields.length >= 3) return;
  if (row.fields.includes(_designer.selectedKey)) return;
  row.fields.push(_designer.selectedKey);
  _designer.selectedKey = null;
  renderDesignerPalette();
  renderDesignerRows();
}

function _removeFieldFromZone(rowIndex, fieldIndex) {
  _designer.template.rows[rowIndex].fields.splice(fieldIndex, 1);
  renderDesignerPalette();
  renderDesignerRows();
}

function _addCustomField() {
  const input = document.getElementById('customFieldInput');
  const label = input?.value.trim();
  if (!label) return;
  const key = 'custom_' + Date.now();
  if (!_designer.template.customFields) _designer.template.customFields = [];
  _designer.template.customFields.push({ key, label });
  if (input) input.value = '';
  renderDesignerPalette();
}

function saveDesignedTemplate() {
  const name = document.getElementById('templateNameInput')?.value.trim();
  if (!name) { alert('Give the template a name first.'); return; }

  _designer.template.name = name;
  if (!_designer.template.id) _designer.template.id = 'tmpl_' + Date.now();

  const templates = _getTemplates();
  const idx = templates.findIndex(t => t.id === _designer.template.id);
  if (idx !== -1) templates[idx] = _designer.template;
  else templates.push(_designer.template);
  _saveTemplates(templates);

  goBack();
}

// ===== SCAN CAP =====
function _checkScanCap() {
  const over500 = state.totalScans >= 500;
  ['abReadBtn','histReadBtn','chemReadBtn','chemReadBackBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = over500;
  });
}

// ===== ANTIBODY SCAN =====
async function initAntibodyScan() {
  document.getElementById('abTotal').textContent = `${state.totalScans} scans`;
  renderUndoStrip();
  renderLastScanned();
  const readBtn = document.getElementById('abReadBtn');
  if (readBtn) readBtn.disabled = true;
  await startCamera('abCameraSlot');
  _checkScanCap();
}

// ===== HISTOLOGY SCAN =====
async function initHistologyScan() {
  // Guard: setup must be complete before the scanner runs
  if (!state.currentStudy || !state.activeTemplate) {
    showScreen('histology-setup', false);
    return;
  }

  const modeLabel = state.histologyMode === 'slides' ? 'Slides' : 'Blocks';
  const titleEl   = document.getElementById('histScanTitle');
  if (titleEl) titleEl.textContent = `Histology — ${modeLabel}`;

  const studyEl = document.getElementById('histStatusStudy');
  if (studyEl) studyEl.textContent = state.currentStudy;

  const tmplEl = document.getElementById('histStatusTemplate');
  if (tmplEl) tmplEl.textContent = state.activeTemplate.name;

  document.getElementById('histTotal').textContent = `${state.totalScans} scans`;
  renderUndoStrip();
  renderLastScanned();

  // Disable shutter until camera stream is confirmed live — prevents tapping during getUserMedia
  const readBtn = document.getElementById('histReadBtn');
  if (readBtn) readBtn.disabled = true;
  await startCamera('histCameraSlot');
  // Re-enable respecting scan cap
  _checkScanCap();
}

// ===== CHEMICAL SCAN =====
async function initChemicalScan() {
  _updateChemStatus();
  renderUndoStrip();
  renderLastScanned();
  _initChemScanMode();
  const readBtn = document.getElementById('chemReadBtn');
  if (readBtn) readBtn.disabled = true;
  await startCamera('chemCameraSlot');
  _checkScanCap();
}

function _getChemScanMode() {
  return localStorage.getItem('chem_scan_mode') || 'single';
}

function _setChemScanMode(mode) {
  localStorage.setItem('chem_scan_mode', mode);
  document.getElementById('chemSingleModeBtn')?.classList.toggle('mode-tab--active', mode === 'single');
  document.getElementById('chemFrontBackModeBtn')?.classList.toggle('mode-tab--active', mode === 'frontback');
  _clearChemFrontScan();
}

function _initChemScanMode() {
  const mode = _getChemScanMode();
  document.getElementById('chemSingleModeBtn')?.classList.toggle('mode-tab--active', mode === 'single');
  document.getElementById('chemFrontBackModeBtn')?.classList.toggle('mode-tab--active', mode === 'frontback');
  if (mode === 'single') _clearChemFrontScan();
  _updateChemReadBtn();
}

function _updateChemReadBtn() {
  const btn = document.getElementById('chemReadBtn');
  if (!btn) return;
  const mode = _getChemScanMode();
  if (mode === 'frontback') {
    btn.innerHTML = state.pendingChemFrontScan
      ? '<i class="ti ti-camera"></i> Read label (back)'
      : '<i class="ti ti-camera"></i> Read label (front)';
  } else {
    btn.innerHTML = '<i class="ti ti-camera"></i> Read label';
  }
}

function _clearChemFrontScan() {
  state.pendingChemFrontScan = null;
  const el = document.getElementById('chemFrontResult');
  if (el) el.classList.add('hidden');
  _updateChemReadBtn();
}

function _renderChemFrontResult(result) {
  const chemFields = FIELDS['chemical'];
  const found = [], missing = [];

  chemFields.forEach(f => {
    const r    = result[f.key] || { value: null, confidence: 'low' };
    const rank = ({ high: 2, medium: 1, low: 0 }[r.confidence] ?? 0);
    if (rank >= 1 && r.value) found.push({ label: f.label, value: r.value });
    else missing.push(f.label);
  });

  let html = '';
  if (found.length) {
    html += `<p class="chem-front-result__label">Found on front</p>`;
    html += found.map(f =>
      `<span class="front-chip front-chip--found"><span class="front-chip__key">${esc(f.label)}</span><span class="front-chip__value">${esc(f.value)}</span></span>`
    ).join('');
  }
  if (missing.length) {
    html += `<p class="chem-front-result__label" style="margin-top:6px">Still missing</p>`;
    html += missing.map(l =>
      `<span class="front-chip front-chip--missing"><span class="front-chip__key">${esc(l)}</span></span>`
    ).join('');
  }

  document.getElementById('chemFrontFound').innerHTML = html;
  document.getElementById('chemFrontResult').classList.remove('hidden');
}

function _updateChemStatus() {
  const chemItems = state.items.filter(i => i.type === 'chemical');
  const confirmed = chemItems.filter(i => i.presentConfirmed).length;
  const totalEl   = document.getElementById('chemTotal');
  const confEl    = document.getElementById('chemConfirmedCount');
  if (totalEl) totalEl.textContent = `${state.totalScans} scans`;
  if (confEl)  confEl.textContent  = `${confirmed}/${chemItems.length} confirmed present`;
}

// ===== CHEMICAL MATCHING =====
function _norm(v) { return String(v ?? '').trim().toLowerCase(); }

function _stripCatalogSuffix(catNum) {
  if (!catNum) return catNum;
  return String(catNum).replace(/-\d+(?:\.\d+)?\s*(?:UG|MG|G|KG|ML|UL|L)$/i, '').trim();
}

function _findChemicalMatch(values) {
  const name    = _norm(values.chemical_description);
  const catalog = _norm(_stripCatalogSuffix(values.catalog_number || ''));
  if (!name) return null;

  // Only consider items not yet confirmed present this session
  const candidates = state.items.filter(i => i.type === 'chemical' && !i.presentConfirmed);
  if (!candidates.length) return null;

  // Primary: fuzzy name (≥0.85) + exact catalog match (both suffix-stripped)
  if (catalog) {
    const hit = candidates.find(i => {
      const iCatalog = _norm(_stripCatalogSuffix(i.fields.catalog_number || ''));
      return iCatalog === catalog && _stringSimilarity(name, _norm(i.fields.chemical_description)) >= 0.85;
    });
    if (hit) return hit;
  }

  // Secondary: name-only fuzzy match (≥0.90)
  const hit = candidates.find(i => _stringSimilarity(name, _norm(i.fields.chemical_description)) >= 0.90);
  return hit || null;
}

async function confirmChemicalScan(values) {
  if (values.catalog_number) values.catalog_number = _stripCatalogSuffix(values.catalog_number);
  const match = _findChemicalMatch(values);
  if (match) {
    await _confirmChemPresent(match);
  } else {
    state.pendingResult = values;
    _buildChemicalNewForm(values);
    showScreen('chemical-new-details');
  }
}

async function _confirmChemPresent(match) {
  match.presentConfirmed = true;
  if (match.status === 'imported') match.status = 'confirmed';
  await updateItemInDB(match);
  const idx = state.items.findIndex(i => i.id === match.id);
  if (idx !== -1) state.items[idx] = match;
  state.totalScans++;
  state.pendingChemMatch = null;
  state.pendingResult    = null;
  _pushUndo({ id: match.id, displayName: match.fields.chemical_description || 'Unknown', chemMatched: true });
  await persistSession();
  showScanScreen(false);
}

function _resetBoxResultForAntibody() {
  const titleEl    = document.querySelector('#screen-box-result .app-title');
  const confirmBtn = document.getElementById('boxConfirmBtn');
  const reviewBtn  = document.getElementById('boxReviewLaterBtn');
  if (titleEl)    titleEl.textContent    = 'Scan result';
  if (confirmBtn) confirmBtn.textContent = 'Confirm and add';
  if (reviewBtn)  reviewBtn.textContent  = 'Review later';
  state.pendingChemMatch = null;
}

function _renderChemicalResultCard(result, match) {
  const confirmBtn = document.getElementById('boxConfirmBtn');
  const reviewBtn  = document.getElementById('boxReviewLaterBtn');
  const card       = document.getElementById('boxResultCard');
  const titleEl    = document.querySelector('#screen-box-result .app-title');

  if (match) {
    if (titleEl)    titleEl.textContent    = 'Match found';
    if (confirmBtn) confirmBtn.textContent = 'Confirm present';
    if (reviewBtn)  reviewBtn.textContent  = 'Add as new entry instead';

    const name    = esc(match.fields.chemical_description || '');
    const catalog = esc(_stripCatalogSuffix(match.fields.catalog_number || ''));
    card.innerHTML = `<div class="chem-match-banner">
      <i class="ti ti-circle-check chem-match-banner__icon"></i>
      <div class="chem-match-banner__body">
        <p class="chem-match-banner__label">Matched in your inventory sheet</p>
        <p class="chem-match-banner__name">${name}</p>
        ${catalog ? `<p class="chem-match-banner__catalog">Cat # ${catalog}</p>` : ''}
      </div>
    </div>`;
  } else {
    if (titleEl)    titleEl.textContent    = 'New chemical';
    if (confirmBtn) confirmBtn.textContent = 'Add to inventory';
    if (reviewBtn)  reviewBtn.textContent  = 'Review later';

    // Hide CAS if not found; default physical_state shown as read
    const displayFields = scanFieldsFor('chemical').filter(f => {
      if (f.key === 'cas_num') return !!(result[f.key]?.value);
      return true;
    });
    renderResultCard(displayFields, result, card);
  }
}

// ===== CHEMICAL NEW DETAILS =====
function _buildChemicalNewForm(scanValues) {
  document.getElementById('chemNewSummary').innerHTML = [
    { label: 'Chemical Name', key: 'chemical_description' },
    { label: 'CAS #',         key: 'cas_num' },
    { label: 'Catalog #',     key: 'catalog_number' },
    { label: 'Vendor',        key: 'vendor' },
  ].filter(f => scanValues[f.key])
   .map(f => `<div class="conflict-row"><strong>${esc(f.label)}</strong>${esc(scanValues[f.key])}</div>`)
   .join('') || '<p class="muted-text">No fields read from label.</p>';

  document.getElementById('chemNewContainers').value  = '';
  document.getElementById('chemNewAmount').value      = '';
  document.getElementById('chemNewUnit').value        = '';
  document.getElementById('chemNewReceiptDate').value = '';
  document.getElementById('chemNewLocation').value    = '';
  document.getElementById('chemNewDevice').value      = '';
}

function initChemicalNewDetails() {
  if (state.pendingResult) _buildChemicalNewForm(state.pendingResult);
}

async function confirmChemicalNew() {
  const scanned = state.pendingResult || {};
  const fields = {
    ...scanned,
    receipt_quantity: document.getElementById('chemNewContainers').value.trim(),
    unit:             document.getElementById('chemNewAmount').value.trim(),
    chemical_unit:    document.getElementById('chemNewUnit').value.trim(),
    receipt_date:     document.getElementById('chemNewReceiptDate').value,
    storage_location: document.getElementById('chemNewLocation').value.trim(),
    storage_device:   document.getElementById('chemNewDevice').value.trim(),
  };

  if (!fields.chemical_description) { alert('Chemical Name is required.'); return; }

  const item = { type: 'chemical', sessionId: state.sessionId, fields, status: 'auto', presentConfirmed: true };
  const id   = await addItemToDB(item);
  item.id    = id;
  state.items.push(item);
  state.totalScans++;
  state.pendingResult = null;
  _pushUndo({ id, displayName: fields.chemical_description || 'Unknown', chemMatched: false });
  await persistSession();
  showScreen('chemical-scan', false);
}

// ===== CHEMICAL RECONCILE =====
function renderChemicalReconcile() {
  const pending = state.items.filter(i => i.type === 'chemical' && !i.presentConfirmed);
  const list    = document.getElementById('chemReconcileList');
  const empty   = document.getElementById('chemReconcileEmpty');

  if (!pending.length) {
    if (list)  list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  list.innerHTML = pending.map(item => {
    const staged = state.chemRemovalStaging[item.id];
    const keepCls   = staged === 'keep'   ? 'btn--primary' : 'btn--outline';
    const removeCls = staged === 'remove' ? 'btn--primary' : 'btn--outline';
    return `<li class="review-item">
      <div class="review-item__header">
        <span class="review-item__name">${esc(item.fields.chemical_description || 'Unknown chemical')}</span>
      </div>
      <p class="review-item__meta">${esc(_stripCatalogSuffix(item.fields.catalog_number || '') || item.fields.storage_location || '')}</p>
      <div class="review-item__actions">
        <button class="btn ${keepCls}"   onclick="stageChemReconcile(${item.id},'keep')">Still present</button>
        <button class="btn ${removeCls}" onclick="stageChemReconcile(${item.id},'remove')">Remove</button>
      </div>
    </li>`;
  }).join('');
}

function stageChemReconcile(id, choice) {
  state.chemRemovalStaging[id] = choice;
  persistSession();
  renderChemicalReconcile();
}

function stageAllChemReconcile(choice) {
  state.items
    .filter(i => i.type === 'chemical' && !i.presentConfirmed)
    .forEach(i => { state.chemRemovalStaging[i.id] = choice; });
  persistSession();
  renderChemicalReconcile();
}

async function applyChemicalReconcile() {
  const pending  = state.items.filter(i => i.type === 'chemical' && !i.presentConfirmed);
  const unstaged = pending.filter(i => !state.chemRemovalStaging[i.id]);

  if (unstaged.length) {
    const ok = confirm(`${unstaged.length} chemical${unstaged.length !== 1 ? 's' : ''} have no decision yet and will be left unchanged. Proceed?`);
    if (!ok) return;
  }

  for (const item of pending) {
    const choice = state.chemRemovalStaging[item.id];
    if (choice === 'remove') {
      await deleteItemFromDB(item.id);
      const idx = state.items.findIndex(i => i.id === item.id);
      if (idx !== -1) state.items.splice(idx, 1);
    } else if (choice === 'keep') {
      item.presentConfirmed = true;
      await updateItemInDB(item);
    }
  }

  const total = state.items.filter(i => i.type === 'chemical').length;
  state.chemRemovalStaging = {};
  await persistSession();

  const metaEl = document.getElementById('endChemMeta');
  if (metaEl) metaEl.textContent = `${total} chemical${total !== 1 ? 's' : ''} on the sheet`;
  showScreen('end-chemical', false);
}

// ===== READ LABEL =====
function _extractFieldValues(apiResult, sessionType) {
  const allDefs = sessionType === 'histology'
    ? [...(FIELDS.histology || []), ...(state.activeTemplate?.customFields || [])]
    : (FIELDS[sessionType] || []);

  const fields = {};
  allDefs.forEach(f => {
    const r = apiResult[f.key];
    let val = (r && typeof r === 'object') ? (r.value ?? '') : (r ?? '');
    if (typeof val === 'string') val = val.replace(/\?+$/, '').trim();
    fields[f.key] = val;
  });
  return fields;
}

function _stripQuestionMarks(apiResult) {
  Object.keys(apiResult).forEach(key => {
    const r = apiResult[key];
    if (r && typeof r === 'object' && typeof r.value === 'string') {
      r.value = r.value.replace(/\?+$/, '').trim();
    }
  });
}

async function handleReadLabel(sessionType) {
  if (!isCameraActive()) {
    showManualEntry('Camera unavailable - enter details manually.');
    return;
  }

  // Antibody uses a two-photo flow
  if (sessionType === 'antibody') {
    if (state.pendingScan1 === null) {
      showLoading('Reading label...');
      try {
        const base64 = captureFrame();
        const result = await readLabelWithClaude(base64, 'antibody', {});
        _stripQuestionMarks(result);
        hideLoading();
        state.pendingScan1 = result;
        _renderAntibodyMidpoint(result);
        showScreen('antibody-midpoint');
      } catch (err) {
        hideLoading();
        showManualEntry(err.message);
      }
    } else {
      showLoading('Reading other side...');
      try {
        const base64  = captureFrame();
        const result2 = await readLabelWithClaude(base64, 'antibody', {});
        _stripQuestionMarks(result2);
        hideLoading();
        const merged = _mergeScanResults(state.pendingScan1, result2);
        state.pendingScan1  = null;
        state.pendingResult = merged;
        _resetBoxResultForAntibody();
        showScreen('box-result');
        renderResultCard(FIELDS['antibody'], merged, document.getElementById('boxResultCard'));
      } catch (err) {
        hideLoading();
        showManualEntry(err.message);
      }
    }
    return;
  }

  // Standard single-photo flow
  showLoading('Reading label...');
  try {
    const base64 = captureFrame();
    const opts   = sessionType === 'histology'
      ? { studyName: state.currentStudy, template: state.activeTemplate, mode: state.histologyMode }
      : {};
    const result = await readLabelWithClaude(base64, sessionType, opts);
    hideLoading();

    _stripQuestionMarks(result);

    // Tissue preset matching for histology
    if (sessionType === 'histology' && result.tissue?.value) {
      const match = _matchTissuePreset(result.tissue.value);
      if (match) result.tissue = match;
    }

    // Study ID handling for histology
    if (sessionType === 'histology' && state.currentStudy) {
      if (result.study_mismatch === true && result.study_id_found) {
        const fields = _extractFieldValues(result, 'histology');
        fields.study_id = state.currentStudy;
        state.reviewQueue.push({
          type: 'histology',
          reason: 'study_mismatch',
          fields,
          studyFound:   String(result.study_id_found),
          studySession: state.currentStudy,
          addedAt: Date.now(),
        });
        updateReviewBadges();
        await persistSession();
        showScanScreen(false);
        return;
      }
      result.study_id = { value: state.currentStudy, confidence: 'locked' };
    }

    // Chemical: strip catalog suffix, default physical_state, front/back or single-shot
    if (sessionType === 'chemical') {
      if (result.catalog_number?.value) {
        result.catalog_number.value = _stripCatalogSuffix(result.catalog_number.value);
      }
      if (!result.physical_state?.value) {
        result.physical_state = { value: 'Solid', confidence: 'high' };
      }

      if (_getChemScanMode() === 'frontback') {
        if (state.pendingChemFrontScan === null) {
          // Front photo complete — show partial result, wait for back
          state.pendingChemFrontScan = result;
          _renderChemFrontResult(result);
          _updateChemReadBtn();
        } else {
          // Back photo complete — merge both scans and proceed
          const merged = _mergeScanResults(state.pendingChemFrontScan, result);
          _clearChemFrontScan();
          if (merged.catalog_number?.value) {
            merged.catalog_number.value = _stripCatalogSuffix(merged.catalog_number.value);
          }
          const extractedVals = _extractFieldValues(merged, 'chemical');
          const chemMatch     = _findChemicalMatch(extractedVals);
          state.pendingChemMatch = chemMatch || null;
          state.pendingResult    = merged;
          showScreen('box-result');
          _renderChemicalResultCard(merged, chemMatch);
        }
        return;
      }

      // Single-photo mode (default)
      const extractedVals = _extractFieldValues(result, 'chemical');
      const chemMatch = _findChemicalMatch(extractedVals);
      state.pendingChemMatch = chemMatch || null;
      state.pendingResult    = result;
      showScreen('box-result');
      _renderChemicalResultCard(result, chemMatch);
      return;
    }

    state.pendingResult = result;

    const screenMap = { histology: 'histology-result' };
    const cardMap   = { histology: 'histResultCard' };
    const screenId  = screenMap[sessionType] || 'box-result';
    const cardId    = cardMap[sessionType]   || 'boxResultCard';
    showScreen(screenId);
    renderResultCard(scanFieldsFor(sessionType), result, document.getElementById(cardId));
  } catch (err) {
    hideLoading();
    try {
      showManualEntry(err.message || 'Scan failed — enter details manually.');
    } catch (e2) {
      console.error('[LabScan] handleReadLabel error (fallback failed):', err, e2);
    }
  }
}

function _mergeScanResults(first, second) {
  const confRank = { high: 2, medium: 1, low: 0 };
  const merged   = {};
  const allKeys  = new Set([...Object.keys(first), ...Object.keys(second)]);

  allKeys.forEach(key => {
    const f = first[key]  || { value: null, confidence: 'low' };
    const s = second[key] || { value: null, confidence: 'low' };
    const fRank = confRank[f.confidence] ?? 0;
    const sRank = confRank[s.confidence] ?? 0;

    if (sRank > fRank)      merged[key] = s;
    else if (fRank > sRank) merged[key] = f;
    else merged[key] = (f.value && !s.value) ? f : (s.value && !f.value) ? s : f;
  });

  return merged;
}

function _renderAntibodyMidpoint(result) {
  const fields   = FIELDS['antibody'];
  const confRank = { high: 2, medium: 1, low: 0 };
  const found = [], missing = [];

  fields.forEach(f => {
    const r    = result[f.key] || { value: null, confidence: 'low' };
    const rank = confRank[r.confidence] ?? 0;
    if (rank >= 2 && r.value) found.push({ ...f, value: r.value });
    else missing.push(f);
  });

  let html = '';
  if (found.length) {
    html += `<div class="midpoint-section">
      <p class="midpoint-section__heading">Found so far</p>
      <div class="midpoint-found">
        ${found.map(f => `<div class="midpoint-chip">
          <span class="midpoint-chip__label">${esc(f.label)}</span>
          <span class="midpoint-chip__value">${esc(f.value)}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }
  if (missing.length) {
    html += `<div class="midpoint-section">
      <p class="midpoint-section__heading">Still missing</p>
      <div class="midpoint-missing">
        ${missing.map(f => `<span class="midpoint-missing-item">${esc(f.label)}</span>`).join('')}
      </div>
    </div>`;
  }

  document.getElementById('abMidpointPreview').innerHTML = html;
}

// ===== TISSUE PRESET MATCHING =====
function _stringSimilarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const getBigrams = s => {
    const map = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };
  const setA = getBigrams(a), setB = getBigrams(b);
  let inter = 0;
  setA.forEach((count, bg) => { if (setB.has(bg)) inter += Math.min(count, setB.get(bg)); });
  return (2 * inter) / ((a.length - 1) + (b.length - 1));
}

function _matchTissuePreset(value) {
  if (!value) return null;
  const v = value.toLowerCase().trim();

  const exact = TISSUE_PRESETS.find(p => p.toLowerCase() === v);
  if (exact) return { value: exact, confidence: 'high' };

  const contains = TISSUE_PRESETS.find(p => {
    const pl = p.toLowerCase();
    return v.includes(pl) || pl.includes(v);
  });
  if (contains) return { value: contains, confidence: 'medium' };

  let bestMatch = null, bestScore = 0;
  TISSUE_PRESETS.forEach(p => {
    const score = _stringSimilarity(v, p.toLowerCase());
    if (score > bestScore) { bestScore = score; bestMatch = p; }
  });
  if (bestScore >= 0.8) return { value: bestMatch, confidence: 'medium' };

  return null;
}

// ===== MANUAL ENTRY =====
function showManualEntry(reason) {
  document.getElementById('manualReason').textContent = reason || 'Enter details manually.';
  _buildManualForm();
  showScreen('manual-entry');
}

function _buildManualForm() {
  const fields = scanFieldsFor(state.sessionType);
  document.getElementById('manualFormFields').innerHTML = fields.map(f => {
    const locked = state.currentStudy && f.key === 'study_id' && state.sessionType === 'histology';
    return `<label class="field-group">
      <span class="field-label">${esc(f.label)}${f.required ? ' *' : ''}${locked ? ' <i class="ti ti-lock" style="font-size:11px;color:var(--accent)"></i>' : ''}</span>
      <input type="${f.type || 'text'}" name="${f.key}" class="input"
        value="${locked ? esc(state.currentStudy) : ''}"
        placeholder="${f.required ? 'Required' : ''}"
        ${locked ? 'readonly style="opacity:0.6;pointer-events:none"' : ''}>
    </label>`;
  }).join('');
}

// ===== RESULT CARD =====
function renderResultCard(fieldDefs, apiResult, container) {
  const locked = [], sure = [], uncertain = [], unreadable = [];

  fieldDefs.forEach(f => {
    const r = apiResult[f.key] || { value: null, confidence: 'low' };
    if (r.confidence === 'locked')            locked.push({ ...f, value: r.value });
    else if (r.confidence === 'high' && r.value) sure.push({ ...f, value: r.value });
    else if (r.confidence === 'medium')       uncertain.push({ ...f, value: r.value });
    else                                      unreadable.push({ ...f });
  });

  let html = '';

  if (locked.length) {
    html += `<div class="result-section result-section--locked">
      <div class="result-section__header">
        <span class="result-dot result-dot--green"></span>
        <span class="result-section__title">Set by you <span class="result-count"><i class="ti ti-lock" style="font-size:11px"></i></span></span>
      </div>
      <div class="result-chips">
        ${locked.map(f => `<span class="field-chip field-chip--locked">
          <i class="ti ti-lock"></i><strong>${esc(f.label)}:</strong> ${esc(f.value)}
          <input type="hidden" class="field-input" name="${f.key}" value="${esc(f.value)}">
        </span>`).join('')}
      </div>
    </div>`;
  }

  if (sure.length) {
    html += `<div class="result-section">
      <div class="result-section__header" onclick="toggleSureSection(this)">
        <span class="result-dot result-dot--green"></span>
        <span class="result-section__title">Confident <span class="result-count">${sure.length}</span></span>
        <i class="ti ti-chevron-down result-toggle"></i>
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
  // Tissue field in histology: show dropdown when uncertain
  if (field.key === 'tissue' && state.sessionType === 'histology' && (kind === 'uncertain' || kind === 'unreadable')) {
    const currentVal = kind === 'uncertain' ? (field.value || '') : '';
    const options = TISSUE_PRESETS.map(p =>
      `<option value="${esc(p)}" ${p === currentVal ? 'selected' : ''}>${esc(p)}</option>`
    ).join('');
    return `<div class="field-row field-row--${kind}">
      <label class="field-label">${esc(field.label)}</label>
      <select class="input field-input" name="${field.key}">
        <option value="">Select tissue...</option>
        ${options}
        <option value="__other__">Other (not on list)</option>
      </select>
      <input type="text" class="input field-input-other hidden" name="${field.key}_other" placeholder="Enter tissue manually..." style="margin-top:6px">
    </div>`;
  }

  const val  = kind === 'uncertain' ? esc(field.value || '') : '';
  const hint = kind === 'uncertain' && field.value
    ? `<p class="field-hint">AI read: "${esc(field.value)}"</p>` : '';
  return `<div class="field-row field-row--${kind}">
    <label class="field-label">${esc(field.label)}</label>
    ${kind === 'unreadable' ? '<span class="eye-off"><i class="ti ti-eye-off"></i></span>' : ''}
    <input type="${field.type || 'text'}" class="input field-input" name="${field.key}"
      value="${val}" placeholder="${kind === 'unreadable' ? 'Enter manually' : ''}">
    ${hint}
  </div>`;
}

function toggleSureSection(headerEl) {
  const section  = headerEl.closest('.result-section');
  const expanded = section.querySelector('.result-expanded');
  const toggle   = section.querySelector('.result-toggle');
  if (expanded) expanded.classList.toggle('hidden');
  if (toggle)   toggle.classList.toggle('open');
}

function collectResultValues(cardEl) {
  const values = {};
  cardEl.querySelectorAll('.field-input').forEach(input => {
    if (input.type === 'hidden') { values[input.name] = input.value; return; }
    if (input.tagName === 'SELECT') {
      const v = input.value;
      if (v === '__other__') {
        const otherInput = input.parentElement.querySelector('.field-input-other');
        values[input.name] = otherInput ? otherInput.value.trim() : '';
      } else {
        values[input.name] = v;
      }
      return;
    }
    values[input.name] = input.value.trim();
  });
  return values;
}

// ===== CONFIRM SCANS =====
async function confirmAntibodyScan(values) {
  state.pendingScan1 = null;
  const conflict = _findConflict('antibody', values);
  if (conflict) {
    state.pendingConflict = { existing: conflict, incoming: values };
    _renderConflictView();
    showScreen('antibody-conflict');
    return;
  }
  const item = { type: 'antibody', sessionId: state.sessionId, fields: values, status: 'auto' };
  const id   = await addItemToDB(item);
  item.id    = id;
  state.items.push(item);
  state.totalScans++;
  _pushUndo({ id, displayName: values.catalog_number || values.target || 'Unknown' });
  await persistSession();
  showScreen('antibody-scan', false);
}

async function confirmHistologyScan(values) {
  const conflict = _findConflict('histology', values);
  if (conflict) {
    addToReviewQueue(values, 'conflict');
    showScreen('histology-scan', false);
    return;
  }
  const item = { type: 'histology', sessionId: state.sessionId, fields: values, status: 'auto' };
  const id   = await addItemToDB(item);
  item.id    = id;
  state.items.push(item);
  state.totalScans++;
  _pushUndo({ id, displayName: values.study_id || values.mouse_id || 'Unknown' });
  await persistSession();
  showScreen('histology-scan', false);
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
      ${esc((typeof data === 'object' && !data.fields ? data : data.fields)?.[f.key] || '-')}
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
  ['reviewBadge2','reviewBadge3','reviewBadge4','reviewBadge5','reviewQueueBadge'].forEach(id => {
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
    if (item.reason === 'study_mismatch') {
      const fields    = [...(FIELDS[item.type] || []), ...(state.activeTemplate?.customFields || [])];
      const nameField = fields.find(f => f.required) || fields[0];
      const name      = item.fields?.[nameField?.key] || 'Scan result';
      return `<li class="review-item">
        <div class="review-item__header">
          <span class="review-item__name">${esc(name)}</span>
          <span class="type-badge type-badge--uncertain">study mismatch</span>
        </div>
        <p class="review-item__meta">Session: "${esc(item.studySession)}" — Label reads: "${esc(item.studyFound)}"</p>
        <div class="review-item__actions">
          <button class="btn btn--primary" onclick="resolveReviewItem(${i},'use_session_study')">Use session ID</button>
          <button class="btn btn--outline" onclick="resolveReviewItem(${i},'use_label_study')">Use label ID</button>
          <button class="btn btn--ghost"   onclick="resolveReviewItem(${i},'drop')">Drop scan</button>
        </div>
      </li>`;
    }
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
    const dbItem = {
      type: item.type, sessionId: state.sessionId,
      fields: item.fields, status: 'corrected',
      ...(item.type === 'chemical' ? { presentConfirmed: true } : {}),
    };
    const id = await addItemToDB(dbItem);
    dbItem.id = id;
    state.items.push(dbItem);
    state.totalScans++;
  } else if (action === 'use_session_study') {
    const dbItem = { type: item.type, sessionId: state.sessionId, fields: item.fields, status: 'corrected' };
    const id = await addItemToDB(dbItem);
    dbItem.id = id;
    state.items.push(dbItem);
    state.totalScans++;
  } else if (action === 'use_label_study') {
    const fields = { ...item.fields, study_id: item.studyFound };
    const dbItem = { type: item.type, sessionId: state.sessionId, fields, status: 'corrected' };
    const id = await addItemToDB(dbItem);
    dbItem.id = id;
    state.items.push(dbItem);
    state.totalScans++;
  }
  // 'drop' — no DB action

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
  if (state.sessionType === 'chemical') {
    _updateChemStatus();
  } else {
    const idMap = { antibody: 'abTotal', histology: 'histTotal' };
    const el = document.getElementById(idMap[state.sessionType]);
    if (el) el.textContent = `${state.totalScans} scans`;
  }
  _checkScanCap();
}

function renderUndoStrip() {
  const ids  = { antibody: 'abUndoStrip', histology: 'histUndoStrip', chemical: 'chemUndoStrip' };
  const strip = document.getElementById(ids[state.sessionType]);
  if (!strip) return;
  strip.innerHTML = state.lastScans.map(s =>
    `<div class="undo-chip">
      <span>${esc(s.displayName)}</span>
      <button class="undo-chip__x" onclick="undoScan(${s.id})">x</button>
    </div>`).join('');
}

async function undoScan(itemId) {
  if (!confirm('Remove this scan?')) return;
  const lastScan = state.lastScans.find(s => s.id === itemId);
  const idx      = state.items.findIndex(i => i.id === itemId);

  if (idx !== -1) {
    const item = state.items[idx];
    if (lastScan?.chemMatched && item.type === 'chemical') {
      item.presentConfirmed = false;
      if (item.status === 'confirmed') item.status = 'imported';
      await updateItemInDB(item);
    } else {
      state.items.splice(idx, 1);
      await deleteItemFromDB(itemId);
    }
    if (state.totalScans > 0) state.totalScans--;
  }

  state.lastScans = state.lastScans.filter(s => s.id !== itemId);
  await persistSession();
  renderUndoStrip();
  renderLastScanned();
  if (state.sessionType === 'chemical') _updateChemStatus();
}

function renderLastScanned() {
  const ids  = { antibody: 'abLastScannedList', histology: 'histLastScannedList', chemical: 'chemLastScannedList' };
  const list = document.getElementById(ids[state.sessionType]);
  if (!list) return;
  list.innerHTML = state.lastScans.slice(0, 8).map(s =>
    `<li class="last-scanned__item">
      <span class="last-scanned__name">${esc(s.displayName)}</span>
    </li>`).join('');
}

// ===== SHEET VIEW =====
function renderSheetView() {
  const allDefs = state.sessionType === 'histology'
    ? [...(FIELDS.histology || []), ...(state.activeTemplate?.customFields || [])]
    : (FIELDS[state.sessionType] || []);

  const search  = (document.getElementById('sheetSearch')?.value || '').toLowerCase();

  // Exclude internal field-name rows (row 2 of the university template)
  const displayable = state.items.filter(i => {
    const chemName = String(i.fields?.chemical_description ?? '');
    return !CHEM_INTERNAL_FIELD_NAMES.has(chemName);
  });

  const visible = search
    ? displayable.filter(i => Object.values(i.fields || {}).some(v => String(v).toLowerCase().includes(search)))
    : displayable;

  document.getElementById('sheetHead').innerHTML =
    `<tr>${allDefs.map(f => `<th>${esc(f.label)}</th>`).join('')}</tr>`;

  document.getElementById('sheetBody').innerHTML = visible.map(item => {
    // Imported items (from original sheet) get no highlight regardless of confirm state.
    // New items scanned this session: orange if manually corrected, yellow otherwise.
    let cls = '';
    if (item.status !== 'imported') {
      cls = item.status === 'corrected' ? 'row--corrected' : 'row--auto';
    }
    const cells = allDefs.map(f => `<td title="${esc(item.fields?.[f.key]||'')}">${esc(item.fields?.[f.key]||'')}</td>`).join('');
    return `<tr class="${cls}">${cells}</tr>`;
  }).join('');

  const dlBtn = document.getElementById('downloadBtn');
  dlBtn.disabled = state.reviewQueue.length > 0;
  dlBtn.title    = state.reviewQueue.length > 0 ? 'Clear review queue before downloading' : '';
}

// ===== COLUMN MAPPING =====
async function _importChemicalsFromSheet() {
  const headers = state.uploadedHeaders;
  const rows    = state.uploadedRows;

  // Chemical Name: header contains "chemical" AND "name", or is literally "chemical_description"
  const nameIdx = headers.findIndex(h => {
    const l = h.toLowerCase();
    return (l.includes('chemical') && l.includes('name')) || l === 'chemical_description';
  });

  // Catalog #: must contain "catalog" — "cat" alone falsely matches "lo[cat]ion"
  const catIdx     = headers.findIndex(h => h.toLowerCase().includes('catalog'));
  const lotIdx     = headers.findIndex(h => /lot/i.test(h));
  const vendorIdx  = headers.findIndex(h => /vendor|supplier/i.test(h));
  const casIdx     = headers.findIndex(h => /\bcas\b/i.test(h));
  const physIdx    = headers.findIndex(h => /physical.?state/i.test(h));
  const locIdx     = headers.findIndex(h => /in.?lab.?loc|storage.?loc/i.test(h));
  const contIdx    = headers.findIndex(h => /of\s*containers/i.test(h));
  const amtIdx     = headers.findIndex(h => /amount\s*per/i.test(h));
  const cuIdx      = headers.findIndex(h => /unit\s*of\s*measure/i.test(h));
  const rcptDtIdx  = headers.findIndex(h => /receipt\s*date/i.test(h));
  // PI columns — stored with __ prefix so exporter can fill them for new chemicals
  const piCodeIdx  = headers.findIndex(h => /pi\s*code/i.test(h));
  const piLastIdx  = headers.findIndex(h => /pi\s*last/i.test(h));
  const piFirstIdx = headers.findIndex(h => /pi\s*first/i.test(h));
  const bldgIdx    = headers.findIndex(h => /bldg/i.test(h));
  const labIdx     = headers.findIndex(h => /^lab$/i.test(h.trim()));

  const mapping = {};
  if (nameIdx     !== -1) mapping[nameIdx]     = 'chemical_description';
  if (catIdx      !== -1) mapping[catIdx]      = 'catalog_number';
  if (lotIdx      !== -1) mapping[lotIdx]      = 'lot_number';
  if (vendorIdx   !== -1) mapping[vendorIdx]   = 'vendor';
  if (casIdx      !== -1) mapping[casIdx]      = 'cas_num';
  if (physIdx     !== -1) mapping[physIdx]     = 'physical_state';
  if (locIdx      !== -1) mapping[locIdx]      = 'storage_location';
  if (contIdx     !== -1) mapping[contIdx]     = 'receipt_quantity';
  if (amtIdx      !== -1) mapping[amtIdx]      = 'unit';
  if (cuIdx       !== -1) mapping[cuIdx]       = 'chemical_unit';
  if (rcptDtIdx   !== -1) mapping[rcptDtIdx]   = 'receipt_date';
  if (piCodeIdx   !== -1) mapping[piCodeIdx]   = '__pi_code';
  if (piLastIdx   !== -1) mapping[piLastIdx]   = '__pi_last';
  if (piFirstIdx  !== -1) mapping[piFirstIdx]  = '__pi_first';
  if (bldgIdx     !== -1) mapping[bldgIdx]     = '__bldg';
  if (labIdx      !== -1) mapping[labIdx]      = '__lab';

  state.uploadedColMapping = mapping;

  // Detect and preserve the field-names row (row 2 of the university template) exactly
  state.uploadedFieldNamesRow = null;
  if (nameIdx !== -1 && rows.length > 0) {
    const testVal = String(rows[0][nameIdx] ?? '').trim();
    if (CHEM_INTERNAL_FIELD_NAMES.has(testVal)) {
      state.uploadedFieldNamesRow = rows[0].map(c => String(c ?? ''));
    }
  }

  if (nameIdx !== -1 && rows.length > 0) {
    await Promise.all(rows.map((row, rowIndex) => {
      const fields = {};
      Object.entries(mapping).forEach(([col, key]) => {
        if (!key.startsWith('__')) fields[key] = String(row[parseInt(col)] ?? '').trim();
      });
      if (!fields.chemical_description) return Promise.resolve();
      if (CHEM_INTERNAL_FIELD_NAMES.has(fields.chemical_description)) return Promise.resolve();
      const originalRow = Array.from({ length: headers.length }, (_, i) => row[i] ?? '');
      const item = {
        type: 'chemical', sessionId: state.sessionId, fields, status: 'imported',
        originalRowIndex: rowIndex, originalRow,
      };
      return addItemToDB(item).then(id => { item.id = id; state.items.push(item); });
    }));
    await persistSession();
  }

  showScreen('chemical-scan');
}

// ===== DOWNLOAD HELPERS =====
let _lastExcelBlob = null;
let _lastExcelFilename = '';

function _wbToBlob(wb) {
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function _buildDownloadBlob() {
  if (!window.XLSX) return null;
  const date = new Date().toISOString().slice(0, 10);
  let wb, filename;
  if (state.sessionType === 'chemical') {
    const chemItems = state.items.filter(i => i.type === 'chemical');
    if (state.uploadedHeaders.length > 0) {
      // Preserve original file structure: same columns, original data, only new rows highlighted
      wb = exportChemicalFromOriginal(
        state.uploadedHeaders,
        state.uploadedColMapping,
        chemItems,
        state.uploadedFieldNamesRow
      );
    } else {
      // No uploaded file — fall back to the university template format
      wb = exportChemicalTemplate(
        chemItems.filter(i => !CHEM_INTERNAL_FIELD_NAMES.has(String(i.fields?.chemical_description ?? '')))
      );
    }
    filename = `chemical-import-${date}.xlsx`;
  } else {
    wb = exportToExcel(state.items, state.sessionType);
    filename = `labscan-${date}.xlsx`;
  }
  if (!wb) return null;
  _lastExcelFilename = filename;
  _lastExcelBlob = _wbToBlob(wb);
  return _lastExcelBlob;
}

function _showDownloadActions() {
  const el = document.getElementById('downloadActions');
  if (el) el.classList.remove('hidden');
}

// Primary download — uses triggerDownload (from excel.js), falls back to data URI
function _runDownload(blob, filename) {
  try {
    triggerDownload(blob, filename);
    _showDownloadActions();
  } catch(e) {
    // triggerDownload unavailable — navigate via data URI (iOS "Open in…" sheet)
    const reader = new FileReader();
    reader.onload = () => { window.location.href = reader.result; };
    reader.readAsDataURL(blob);
    _showDownloadActions();
  }
}

// "Can't download? Tap here to open file" handler
function _openExcelFallback() {
  const blob = _lastExcelBlob || _buildDownloadBlob();
  if (!blob) return;
  try {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const reader = new FileReader();
      reader.onload = () => { window.location.href = reader.result; };
      reader.readAsDataURL(blob);
    }
  } catch(e) {
    const reader = new FileReader();
    reader.onload = () => { window.location.href = reader.result; };
    reader.readAsDataURL(blob);
  }
}

// "Email sheet to myself" — Web Share API with file (works on iOS), mailto fallback
async function _emailSheet() {
  const blob = _lastExcelBlob || _buildDownloadBlob();
  if (!blob) return;
  const filename = _lastExcelFilename || `labscan-${new Date().toISOString().slice(0,10)}.xlsx`;
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: 'Lab Sheet', files: [file] });
      return;
    } catch(e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback: mailto with plain-text summary in body (file attachment via mailto is not supported by browsers)
  const lines = state.items
    .filter(i => !CHEM_INTERNAL_FIELD_NAMES.has(String(i.fields?.chemical_description ?? '')))
    .map(i => [i.fields?.chemical_description, i.fields?.catalog_number].filter(Boolean).join('\t'))
    .filter(Boolean);
  const body = `Lab inventory (${lines.length} items):\n\n${lines.join('\n')}`;
  window.location.href = `mailto:?subject=${encodeURIComponent('Lab Sheet — ' + filename)}&body=${encodeURIComponent(body)}`;
}

// "Copy data as text" — copies chemical names + catalog numbers to clipboard
function _copyDataAsText() {
  const items = state.items.filter(i =>
    !CHEM_INTERNAL_FIELD_NAMES.has(String(i.fields?.chemical_description ?? ''))
  );
  const lines = items.map(i => {
    const name = i.fields?.chemical_description || '';
    const cat  = i.fields?.catalog_number || '';
    return [name, cat].filter(Boolean).join('\t');
  }).filter(Boolean);

  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const el = document.getElementById('copySuccess');
    if (el) { el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2500); }
  }).catch(() => {
    // Clipboard API blocked — show raw text fallback
    const errEl = document.getElementById('downloadError');
    if (errEl) { errEl.textContent = 'Copy failed — clipboard access denied.'; errEl.classList.remove('hidden'); }
  });
}

// ===== LOADING =====
function showLoading(msg) {
  document.getElementById('loadingMsg').textContent = msg || 'Loading...';
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

  // Tissue dropdown → show/hide other input
  document.addEventListener('change', e => {
    if (e.target.classList.contains('field-input') && e.target.tagName === 'SELECT') {
      const parent = e.target.closest('.field-row');
      if (!parent) return;
      const otherInput = parent.querySelector('.field-input-other');
      if (otherInput) otherInput.classList.toggle('hidden', e.target.value !== '__other__');
    }
  });

  // Settings drawer
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('apiKeyInput').value  = localStorage.getItem('anthropic_api_key') || '';
    document.getElementById('chemPiCode').value   = localStorage.getItem('labscan_pi_code')      || '';
    document.getElementById('chemPiLast').value   = localStorage.getItem('labscan_pi_lastname')  || '';
    document.getElementById('chemPiFirst').value  = localStorage.getItem('labscan_pi_firstname') || '';
    document.getElementById('chemBldg').value     = localStorage.getItem('labscan_bldg_code')    || '';
    document.getElementById('chemLab').value      = localStorage.getItem('labscan_lab')          || '';
    const drawer = document.getElementById('settingsDrawer');
    drawer.classList.remove('hidden');
    drawer.querySelector('.drawer__panel').scrollTop = 0;
  });
  ['settingsBackdrop','closeSettingsBtn'].forEach(id =>
    document.getElementById(id).addEventListener('click', () =>
      document.getElementById('settingsDrawer').classList.add('hidden')
    )
  );
  document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
    const raw = document.getElementById('apiKeyInput').value;
    const k   = (typeof cleanApiKey === 'function') ? cleanApiKey(raw) : raw.trim();
    console.log('[LabScan] Saving API key to localStorage, length:', k.length);
    if (k) localStorage.setItem('anthropic_api_key', k);
    const chemFields = {
      labscan_pi_code:      'chemPiCode',
      labscan_pi_lastname:  'chemPiLast',
      labscan_pi_firstname: 'chemPiFirst',
      labscan_bldg_code:    'chemBldg',
      labscan_lab:          'chemLab',
    };
    Object.entries(chemFields).forEach(([lsKey, elId]) => {
      const v = document.getElementById(elId).value.trim();
      if (v) localStorage.setItem(lsKey, v);
    });
    document.getElementById('settingsDrawer').classList.add('hidden');
  });

  // Session type buttons
  document.getElementById('startAntibodyBtn').addEventListener('click',  () => startSession('antibody'));
  document.getElementById('startHistologyBtn').addEventListener('click', () => startSession('histology'));

  // Histology setup
  document.getElementById('histStudyIdInput')?.addEventListener('input', _validateHistologySetup);
  document.getElementById('histTemplateSelect')?.addEventListener('change', _validateHistologySetup);
  document.getElementById('continueHistologyBtn')?.addEventListener('click', continueToPreview);
  document.getElementById('openTemplateLibraryBtn')?.addEventListener('click', () => {
    showScreen('template-library');
  });

  // Session preview
  document.getElementById('startHistScanBtn')?.addEventListener('click', () => {
    if (!state.currentStudy || !state.activeTemplate) { showScreen('histology-setup', false); return; }
    showScreen('histology-scan');
  });
  document.getElementById('changeHistSettingsBtn')?.addEventListener('click', goBack);

  // Template library
  document.getElementById('newTemplateBtn').addEventListener('click', newTemplate);

  // Template designer
  document.getElementById('saveTemplateBtn').addEventListener('click', saveDesignedTemplate);
  document.getElementById('addCustomFieldBtn').addEventListener('click', _addCustomField);
  document.getElementById('customFieldInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _addCustomField(); }
  });
  document.getElementById('deleteTemplateBtn').addEventListener('click', deleteCurrentTemplate);

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
    showLoading('Reading file...');
    try {
      const { headers, rows } = await readExcelFile(file);
      hideLoading();
      state.uploadedHeaders  = headers;
      state.uploadedRows     = rows;
      state.uploadedFileName = file.name;
      updateHomeUploadCard();
    } catch (err) {
      hideLoading();
      alert('Could not read file: ' + err.message);
    }
  });

  // Box result (shared antibody result screen)
  document.getElementById('boxResultBackBtn').addEventListener('click', goBack);
  document.getElementById('boxConfirmBtn').addEventListener('click', async () => {
    if (state.sessionType === 'chemical') {
      if (state.pendingChemMatch) {
        await _confirmChemPresent(state.pendingChemMatch);
      } else {
        const vals = _extractFieldValues(state.pendingResult, 'chemical');
        _buildChemicalNewForm(vals);
        state.pendingResult = vals;
        showScreen('chemical-new-details');
      }
      return;
    }
    const values = collectResultValues(document.getElementById('boxResultCard'));
    await confirmAntibodyScan(values);
  });
  document.getElementById('boxReviewLaterBtn').addEventListener('click', () => {
    if (state.sessionType === 'chemical') {
      if (state.pendingChemMatch) {
        // "Add as new entry instead" — clear match, go to new-details form
        state.pendingChemMatch = null;
        const vals = _extractFieldValues(state.pendingResult, 'chemical');
        _buildChemicalNewForm(vals);
        state.pendingResult = vals;
        showScreen('chemical-new-details');
      } else {
        // Review later — add to queue, back to scanner
        const vals = _extractFieldValues(state.pendingResult, 'chemical');
        addToReviewQueue(vals, 'uncertain');
        state.pendingChemMatch = null;
        state.pendingResult    = null;
        showScanScreen(false);
      }
      return;
    }
    const card   = document.getElementById('boxResultCard');
    const values = collectResultValues(card);
    const reason = card.querySelector('.field-row--unreadable') ? 'unreadable'
                 : card.querySelector('.field-row--uncertain')  ? 'uncertain' : 'pending';
    addToReviewQueue(values, reason);
    showScanScreen(false);
  });

  // Antibody scan
  document.getElementById('abScanBackBtn').addEventListener('click', goBack);
  document.getElementById('abReadBtn').addEventListener('click', () => handleReadLabel('antibody'));
  document.getElementById('abTypeBtn').addEventListener('click', () => showManualEntry('Enter antibody details manually.'));

  // Antibody midpoint
  document.getElementById('abMidpointBackBtn').addEventListener('click', () => {
    state.pendingScan1 = null;
    goBack();
  });
  document.getElementById('abScanOtherSideBtn').addEventListener('click', () => showScreen('antibody-scan', false));
  document.getElementById('abUseFirstScanBtn').addEventListener('click', () => {
    state.pendingResult = state.pendingScan1;
    state.pendingScan1  = null;
    _resetBoxResultForAntibody();
    showScreen('box-result', false);
    renderResultCard(FIELDS['antibody'], state.pendingResult, document.getElementById('boxResultCard'));
  });

  // Antibody conflict
  document.getElementById('conflictKeepBtn').addEventListener('click', () => {
    state.pendingConflict = null;
    showScanScreen(false);
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
    showScanScreen(false);
  });
  document.getElementById('conflictAddNewBtn').addEventListener('click', async () => {
    const { incoming } = state.pendingConflict || {};
    if (incoming) {
      const item = { type: state.sessionType, sessionId: state.sessionId, fields: incoming, status: 'auto' };
      const id   = await addItemToDB(item);
      item.id    = id;
      state.items.push(item);
      state.totalScans++;
      _pushUndo({ id, displayName: incoming.catalog_number || incoming.mouse_id || 'Unknown' });
      await persistSession();
    }
    state.pendingConflict = null;
    showScanScreen(false);
  });
  document.getElementById('conflictReviewBtn').addEventListener('click', () => {
    const { incoming } = state.pendingConflict || {};
    if (incoming) addToReviewQueue(incoming, 'conflict');
    state.pendingConflict = null;
    showScanScreen(false);
  });

  // Histology scan
  document.getElementById('histScanBackBtn').addEventListener('click', goBack);
  document.getElementById('histReadBtn').addEventListener('click', () => handleReadLabel('histology'));
  document.getElementById('histTypeBtn').addEventListener('click', () => showManualEntry('Enter slide details manually.'));

  // Histology result
  document.getElementById('histResultBackBtn').addEventListener('click', goBack);
  document.getElementById('histConfirmBtn').addEventListener('click', async () => {
    const values = collectResultValues(document.getElementById('histResultCard'));
    await confirmHistologyScan(values);
  });
  document.getElementById('histReviewLaterBtn').addEventListener('click', () => {
    const card   = document.getElementById('histResultCard');
    const values = collectResultValues(card);
    const reason = card.querySelector('.field-row--unreadable') ? 'unreadable' : 'uncertain';
    addToReviewQueue(values, reason);
    showScreen('histology-scan', false);
  });

  // Chemical setup
  document.getElementById('startChemicalBtn').addEventListener('click', () => startSession('chemical'));
  // Chemical scan
  document.getElementById('chemScanBackBtn').addEventListener('click', goBack);
  document.getElementById('chemReadBtn').addEventListener('click', () => handleReadLabel('chemical'));
  document.getElementById('chemTypeBtn').addEventListener('click', () => showManualEntry('Enter chemical details manually.'));
  document.getElementById('endChemBtn').addEventListener('click', () => showScreen('chemical-reconcile'));

  // Chemical new details
  document.getElementById('chemNewAddBtn').addEventListener('click', confirmChemicalNew);

  // Manual entry
  document.getElementById('manualSubmitBtn').addEventListener('click', async () => {
    const values = {};
    document.getElementById('manualFormFields').querySelectorAll('input,select').forEach(el => {
      if (el.name) values[el.name] = el.value.trim();
    });
    const req = scanFieldsFor(state.sessionType).find(f => f.required);
    if (req && !values[req.key]) { alert(`${req.label} is required.`); return; }
    if (state.sessionType === 'antibody')  await confirmAntibodyScan(values);
    else if (state.sessionType === 'histology') await confirmHistologyScan(values);
    else if (state.sessionType === 'chemical')  await confirmChemicalScan(values);
  });

  // Review queue
  document.getElementById('reviewBackBtn').addEventListener('click', goBack);

  // Sheet view
  document.getElementById('sheetSearch').addEventListener('input', renderSheetView);
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const errEl = document.getElementById('downloadError');
    if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }

    if (!window.XLSX) {
      if (errEl) { errEl.textContent = 'Excel library not loaded.'; errEl.classList.remove('hidden'); }
      return;
    }

    const blob = _buildDownloadBlob();
    if (!blob) return;
    _runDownload(blob, _lastExcelFilename);
  });

  document.getElementById('emailSheetBtn').addEventListener('click', _emailSheet);
  document.getElementById('copyDataBtn').addEventListener('click', _copyDataAsText);

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
  if (window.navigator.standalone) document.body.classList.add('pwa-mode');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
