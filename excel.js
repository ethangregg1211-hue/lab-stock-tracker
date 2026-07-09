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
  const extraCols = sessionType === 'box' ? ['Box', 'Position'] : [];
  const headers = [...extraCols, ...fields.map(f => f.label), 'Date added', 'Status'];

  const wsRows = items.map(item => {
    const row = [];
    if (sessionType === 'box') {
      row.push(item.boxNumber || '', item.position || '');
    }
    fields.forEach(f => row.push(item.fields?.[f.key] ?? ''));
    row.push(item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '');
    row.push(item.status || 'auto');
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...wsRows]);

  // Apply row fill: yellow for auto-added (#FFEFC0), orange for corrected (#FFD9B3)
  items.forEach((item, i) => {
    const rowIdx = i + 1; // 0 = header
    const rgb = item.status === 'corrected' ? 'FFD9B3' : 'FFEFC0';
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
  XLSX.writeFile(wb, filename || `lab-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
    box: {
      sample_name: ['sample', 'name', 'samplename', 'sampleid', 'id', 'label', 'tubeid'],
      date:        ['date', 'dateadded', 'created', 'collected', 'frozen', 'stored'],
      researcher:  ['researcher', 'initials', 'user', 'by', 'tech', 'operator', 'pi'],
      volume:      ['volume', 'amount', 'vol', 'qty', 'quantity', 'ul', 'ml', 'conc'],
      description: ['desc', 'description', 'notes', 'content', 'type', 'comment'],
    },
    histology: {
      accession_number: ['accession', 'accno', 'caseno', 'case', 'patno', 'patientno', 'surgpath'],
      slide_number:     ['slide', 'slideno', 'section', 'cut', 'blockcutno'],
      stain:            ['stain', 'staintype', 'dye', 'ihc', 'he', 'special'],
      tissue:           ['tissue', 'organ', 'site', 'tissuetype', 'specimen'],
      diagnosis:        ['diagnosis', 'diag', 'pathology', 'finding', 'result'],
      date:             ['date', 'cutdate', 'staindate', 'prepared', 'processed'],
      researcher:       ['researcher', 'tech', 'pathologist', 'initials', 'signedby'],
      block_id:         ['block', 'blockid', 'paraffinblock', 'cassette'],
    },
  };

  const typeMap = maps[sessionType] || {};
  for (const [field, keywords] of Object.entries(typeMap)) {
    if (keywords.some(k => h.includes(k))) return field;
  }
  return '';
}
