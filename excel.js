function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const headers = (raw[0] || []).map(String);
        const rows = raw.slice(1).filter(r => r.some(c => c !== ''));
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function exportToExcel(items, sessionType, filename) {
  if (!window.XLSX) { alert('Excel library not loaded.'); return; }

  // FIELDS is defined globally in app.js
  const fields = (typeof FIELDS !== 'undefined' && FIELDS[sessionType]) || [];
  const headers = [...fields.map(f => f.label), 'Date added', 'Status'];

  const wsRows = items.map(item => {
    const row = [];
    fields.forEach(f => row.push(item.fields?.[f.key] ?? ''));
    row.push(item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '');
    row.push(item.status || 'auto');
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...wsRows]);

  // Apply row fill: yellow for auto-added (#FFEFC0), orange for corrected (#FFD9B3)
  items.forEach((item, i) => {
    const rowIdx = i + 1; // 0 = header
    const rgb = item.status === 'corrected' ? 'FFCC80' : 'FFE082';
    const fill = { patternType: 'solid', fgColor: { rgb } };
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
      if (!ws[ref]) ws[ref] = { v: '', t: 's' };
      ws[ref].s = { fill };
    }
  });

  // Column widths
  ws['!cols'] = headers.map(() => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  return wb;
}

function exportChemicalTemplate(items, filename) {
  if (!window.XLSX) { alert('Excel library not loaded.'); return; }

  const HEADERS = [
    'PI CODE','PI Last Name','PI First Name','Bldg Code','LAB',
    'Storage Location','Sub-Storage Location','Storage Requirements','Storage Device',
    'Chemical Name','Physical State','# of Containers','Amount per Container','Unit of Measure',
    'CAS #','Chemical Formula','Molecular Weight','Vendor','Catalog #','PO#',
    'Receipt Date','Open Date','MAX on Hand','Expiration Date','Contact','Comments',
    'MSDS Year','Date Entered','BARCODE','LAST_CHANGED','CONCENTRATION',
    'Chemical Number','Lot Number','Multiple CAS (comma delimited)','MSDS URL',
    'Order Date','Will Expire?',
  ];

  // Row 2: internal field names — must never be modified
  const FIELD_NAMES = [
    'researcher','last_name','first_name','building','lab',
    'storage_location','sub_storage_location','storage_requirements','storage_device',
    'chemical_description','physical_state','receipt_quantity','unit','chemical_unit',
    'cas_num','chemical_formula','molecular_weight','vendor','catalog_number','po_number',
    'receipt_date','open_date','max_on_hand','expiration_date','contact','comments',
    '','date_entered','ship_code','last_updated','concentration',
    'chemical_number','lot_number','multiple_cas','msds_url',
    'order_date','will_expire',
  ];

  const piCode  = localStorage.getItem('labscan_pi_code')      || '';
  const piLast  = localStorage.getItem('labscan_pi_lastname')  || '';
  const piFirst = localStorage.getItem('labscan_pi_firstname') || '';
  const bldg    = localStorage.getItem('labscan_bldg_code')    || '';
  const defLab  = localStorage.getItem('labscan_lab')          || '';

  const dataRows = items.map(f => {
    const d = f.fields || {};
    return [
      piCode, piLast, piFirst, bldg,
      d.lab || defLab,
      d.storage_location || '', '', '', d.storage_device || '',
      d.chemical_description || '', d.physical_state || '',
      d.receipt_quantity || '', d.unit || '', d.chemical_unit || '',
      d.cas_num || '', '', '', d.vendor || '', d.catalog_number || '', '',
      d.receipt_date || '', '', '', '', '', '',
      '', '', '', '', d.concentration || '',
      '', d.lot_number || '', '', '',
      '', '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, FIELD_NAMES, ...dataRows]);

  // Hide the field-names row (row index 1, 0-based)
  ws['!rows'] = [undefined, { hidden: true }];

  // Column widths — wider for text fields
  ws['!cols'] = HEADERS.map((h, i) => ({
    wch: ['Chemical Name','Storage Location','PI Last Name','PI First Name'].includes(h) ? 24 : 14,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}

// Export using the original uploaded file's column structure.
// Row 1: same headers as uploaded file.
// Row 2: field-names row from uploaded file (hidden), preserved exactly.
// Row 3+: original rows reconstructed from item.originalRow (sorted by originalRowIndex);
//         new chemicals (status auto/corrected) appended with yellow/orange fill.
function exportChemicalFromOriginal(uploadedHeaders, colMapping, items, fieldNamesRow) {
  if (!window.XLSX) return null;

  const piCode  = localStorage.getItem('labscan_pi_code')      || 'P049';
  const piLast  = localStorage.getItem('labscan_pi_lastname')  || 'Welm Lab';
  const piFirst = localStorage.getItem('labscan_pi_firstname') || 'Alana/Bryan';
  const bldg    = localStorage.getItem('labscan_bldg_code')    || '0554';
  const defLab  = localStorage.getItem('labscan_lab')          || '02549';
  const piValues = { '__pi_code': piCode, '__pi_last': piLast, '__pi_first': piFirst, '__bldg': bldg, '__lab': defLab };

  const outputRows = [];

  // Reconstruct original rows from per-item originalRow arrays, sorted by their position in the file
  const importedItems = items
    .filter(i => (i.status === 'imported' || i.status === 'confirmed') && i.originalRow)
    .sort((a, b) => (a.originalRowIndex ?? 0) - (b.originalRowIndex ?? 0));

  importedItems.forEach(item => {
    outputRows.push({ cells: uploadedHeaders.map((_, c) => item.originalRow[c] ?? ''), isNew: false, corrected: false });
  });

  // Append chemicals added this session (not imported from file)
  items.filter(i => i.status !== 'imported' && i.status !== 'confirmed').forEach(item => {
    const row = new Array(uploadedHeaders.length).fill('');
    Object.entries(colMapping).forEach(([col, key]) => {
      const colIdx = parseInt(col, 10);
      if (key.startsWith('__')) {
        row[colIdx] = piValues[key] || '';
      } else {
        const v = item.fields?.[key];
        if (v !== undefined && v !== null && v !== '') row[colIdx] = v;
      }
    });
    outputRows.push({ cells: row, isNew: true, corrected: item.status === 'corrected' });
  });

  // Build the field-names row (row 2) — use what was read from the file, or an empty row
  const fieldNamesRowCells = fieldNamesRow
    ? uploadedHeaders.map((_, c) => String(fieldNamesRow[c] ?? ''))
    : new Array(uploadedHeaders.length).fill('');

  const aoa = [uploadedHeaders, fieldNamesRowCells, ...outputRows.map(r => r.cells)];
  const ws  = XLSX.utils.aoa_to_sheet(aoa);

  // Hide row 2 (field-names row) — same as the original uploaded file
  ws['!rows'] = [undefined, { hidden: true }];

  // Highlight new chemical rows: yellow (#FFEFC0) for auto, orange (#FFD9B3) for corrected
  outputRows.forEach((entry, i) => {
    if (!entry.isNew) return;
    const rowIdx = i + 2; // +1 for header, +1 for field-names row
    const rgb    = entry.corrected ? 'FFD9B3' : 'FFEFC0';
    for (let c = 0; c < uploadedHeaders.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
      if (!ws[ref]) ws[ref] = { v: '', t: 's' };
      ws[ref].s = { fill: { patternType: 'solid', fgColor: { rgb } } };
    }
  });

  ws['!cols'] = uploadedHeaders.map(h => ({ wch: Math.max(String(h).length + 2, 14) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function guessFieldFromHeader(header, sessionType) {
  const h = header.toLowerCase().replace(/[\s_\-#.()]/g, '');
  const maps = {
    antibody: {
      catalog_number: ['cat', 'catalog', 'catnumber', 'catalogno', 'catno', 'productno', 'prodno', 'itemno'],
      lot_number:     ['lot', 'lotnumber', 'lotno', 'batch', 'batchno'],
      target:         ['target', 'antigen', 'protein', 'specificity', 'against'],
      host_species:   ['host', 'species', 'raisedin', 'hostspecies', 'animal', 'source'],
      clone:          ['clone', 'cloneid', 'cloneno'],
      concentration:  ['conc', 'concentration', 'titer', 'mgml', 'ugml'],
      expiry:         ['expiry', 'expiration', 'exp', 'expirydate', 'useby', 'bestbefore'],
      storage:        ['storage', 'storagecond', 'condition', 'temp', 'temperature', 'store'],
    },
    histology: {
      study_id:      ['study', 'studyid', 'studyno', 'project', 'protocol', 'experiment'],
      mouse_id:      ['mouse', 'mouseid', 'sample', 'sampleid', 'animal', 'animalid', 'subject', 'id'],
      tissue:        ['tissue', 'organ', 'site', 'tissuetype', 'specimen'],
      stain:         ['stain', 'staintype', 'dye', 'ihc', 'he', 'special'],
      slide_no:      ['slide', 'slideno', 'slidenumber', 'section', 'sectionno'],
      block_no:      ['block', 'blockno', 'blocknumber', 'paraffin', 'paraffinblock'],
      fix:           ['fix', 'fixative', 'fixation'],
      initials:      ['initials', 'initial', 'by', 'preparedby', 'tech'],
      date:          ['date', 'dated', 'processeddate', 'cutdate'],
      treatment:     ['treatment', 'treat', 'drug', 'dose'],
      group:         ['group', 'grp', 'cohort', 'arm'],
      accession_no:  ['accession', 'accessionno', 'accno', 'acc'],
      experiment_id: ['experiment', 'experimentid', 'expid', 'exp'],
    },
    chemical: {
      chemical_description: ['chemicalname', 'chemical', 'chemname', 'name', 'description', 'chemical_description'],
      cas_num:              ['cas', 'casnumber', 'casno', 'casnum', 'cas#'],
      catalog_number:       ['catalog', 'catalogno', 'catno', 'cat', 'catalognum', 'catalog#'],
      vendor:               ['vendor', 'supplier', 'manufacturer', 'mfr', 'company'],
      physical_state:       ['physicalstate', 'state', 'form', 'phase'],
      receipt_quantity:     ['containers', 'ofcontainers', 'qty', 'quantity', 'count', 'number'],
      unit:                 ['amountper', 'amount', 'amtper', 'size'],
      chemical_unit:        ['unitofmeasure', 'uom', 'units', 'unitofmeas'],
      storage_location:     ['storagelocation', 'inlablocation', 'location', 'storage', 'inlab', 'loc'],
      storage_device:       ['storagedevice', 'device', 'locationtype', 'cabinet', 'fridge', 'freezer'],
      receipt_date:         ['receiptdate', 'received', 'daterecvd', 'receiveddate', 'datereceived'],
      lot_number:           ['lot', 'lotnumber', 'lotno', 'lot#', 'batch'],
      concentration:        ['concentration', 'conc', 'concn', 'purity'],
    },
  };

  const typeMap = maps[sessionType] || {};
  for (const [field, keywords] of Object.entries(typeMap)) {
    if (keywords.some(k => h.includes(k))) return field;
  }
  return '';
}
