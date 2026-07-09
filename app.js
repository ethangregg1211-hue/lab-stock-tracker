let allItems = [];
let editingId = null;

async function init() {
  await openDB();
  await loadInventory();
  bindEvents();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
}

async function loadInventory() {
  allItems = await getAllItems();
  renderInventory(allItems);
}

function renderInventory(items) {
  const list = document.getElementById('inventoryList');
  list.innerHTML = '';

  if (items.length === 0) {
    list.innerHTML = '<li style="color:var(--muted);text-align:center;padding:1rem;">No items yet.</li>';
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-meta">Qty: ${item.qty} &middot; ${escapeHtml(item.category || 'Uncategorized')}</div>
      </div>
      <div class="item-actions">
        <button onclick="openEditModal(${item.id})">Edit</button>
        <button class="btn-danger" onclick="removeItem(${item.id})">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function bindEvents() {
  document.getElementById('scanBtn').addEventListener('click', async () => {
    const result = await scanAndIdentify();
    if (result) openAddModal(result);
    else openAddModal();
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    exportToExcel(allItems);
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allItems.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
    );
    renderInventory(filtered);
  });

  document.getElementById('saveItemBtn').addEventListener('click', saveItem);
  document.getElementById('cancelItemBtn').addEventListener('click', closeModal);
}

function openAddModal(prefill = {}) {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Item';
  document.getElementById('itemName').value = prefill.name || '';
  document.getElementById('itemQty').value = prefill.qty || 1;
  document.getElementById('itemCategory').value = prefill.category || '';
  document.getElementById('itemNotes').value = prefill.notes || '';
  document.getElementById('itemModal').classList.remove('hidden');
}

function openEditModal(id) {
  const item = allItems.find((i) => i.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Item';
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemQty').value = item.qty;
  document.getElementById('itemCategory').value = item.category || '';
  document.getElementById('itemNotes').value = item.notes || '';
  document.getElementById('itemModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('itemModal').classList.add('hidden');
  editingId = null;
}

async function saveItem() {
  const name = document.getElementById('itemName').value.trim();
  const qty = parseInt(document.getElementById('itemQty').value, 10) || 0;
  const category = document.getElementById('itemCategory').value.trim();
  const notes = document.getElementById('itemNotes').value.trim();

  if (!name) {
    alert('Item name is required.');
    return;
  }

  if (editingId !== null) {
    const existing = allItems.find((i) => i.id === editingId);
    await updateItem({ ...existing, name, qty, category, notes });
  } else {
    await addItem({ name, qty, category, notes });
  }

  closeModal();
  await loadInventory();
}

async function removeItem(id) {
  if (!confirm('Delete this item?')) return;
  await deleteItem(id);
  await loadInventory();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
