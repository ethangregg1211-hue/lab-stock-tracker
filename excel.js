// Requires SheetJS (xlsx) loaded via CDN or bundled separately.
// Add to index.html: <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>

function exportToExcel(items) {
  if (!window.XLSX) {
    alert('Excel library not loaded.');
    return;
  }

  const rows = items.map((item) => ({
    ID: item.id,
    Name: item.name,
    Quantity: item.qty,
    Category: item.category || '',
    Notes: item.notes || '',
    'Created At': new Date(item.createdAt).toLocaleString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

  const filename = `lab-stock-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
