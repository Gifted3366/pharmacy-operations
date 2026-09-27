const STORAGE_KEYS = {
  business: 'pharmacyOps.business',
  inventory: 'pharmacyOps.inventory',
  transactions: 'pharmacyOps.transactions',
  settings: 'pharmacyOps.settings',
};

const CATEGORY_OPTIONS = ['Antibiotics', 'Analgesics', 'Vitamins', 'Antimalarials', 'Antihistamines', 'Other'];

const defaultBusiness = { id: 'business-1', name: 'GreenLife Pharmacy', createdAt: new Date().toISOString() };
const defaultSettings = { currency: '₦ Nigerian Naira', lowStockThreshold: 10 };

const demoProducts = [
  { id: 'prod-amox', name: 'Amoxicillin Demo', batchNumber: 'AMX-2048', category: 'Antibiotics', stock: 6, expiryDate: futureDate(110), unitPrice: 1400, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'prod-para', name: 'Paracetamol Demo', batchNumber: 'PCM-1197', category: 'Analgesics', stock: 20, expiryDate: futureDate(180), unitPrice: 980, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'prod-vitc', name: 'Vitamin C Demo', batchNumber: 'VTC-7750', category: 'Vitamins', stock: 17, expiryDate: futureDate(65), unitPrice: 2100, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'prod-anti', name: 'Antimalarial Demo', batchNumber: 'MLR-3301', category: 'Antimalarials', stock: 8, expiryDate: futureDate(25), unitPrice: 3200, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'prod-cet', name: 'Cetirizine Demo', batchNumber: 'CET-6546', category: 'Antihistamines', stock: 12, expiryDate: futureDate(150), unitPrice: 1700, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const state = {
  currentPage: 'overview',
  business: { ...defaultBusiness },
  settings: { ...defaultSettings },
  inventory: [...demoProducts],
  transactions: [],
  cart: [],
  selectedProductId: null,
  filters: {
    inventorySearch: '',
    inventoryCategory: 'All',
    inventoryStatus: 'All',
    transactionSearch: '',
    transactionDate: '',
  },
};

const appContent = document.getElementById('app-content');
const modalRoot = document.getElementById('modal-root');
const sidebar = document.getElementById('sidebar');
const mobileToggle = document.getElementById('mobile-menu-toggle');

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeNumber(value, 0));
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function persistState() {
  saveData(STORAGE_KEYS.business, state.business);
  saveData(STORAGE_KEYS.settings, state.settings);
  saveData(STORAGE_KEYS.inventory, state.inventory);
  saveData(STORAGE_KEYS.transactions, state.transactions);
}

function ensureDefaultData() {
  const business = loadData(STORAGE_KEYS.business, null);
  const settings = loadData(STORAGE_KEYS.settings, null);
  const inventory = loadData(STORAGE_KEYS.inventory, null);
  const transactions = loadData(STORAGE_KEYS.transactions, null);

  state.business = business && business.name ? business : { ...defaultBusiness };
  state.settings = settings && Number.isFinite(Number(settings.lowStockThreshold)) ? settings : { ...defaultSettings };
  state.inventory = Array.isArray(inventory) && inventory.length > 0 ? inventory : [...demoProducts];
  state.transactions = Array.isArray(transactions) ? transactions : [];
  state.selectedProductId = state.inventory[0]?.id || null;
  persistState();
}

function updateBusinessNames() {
  const name = state.business.name || 'GreenLife Pharmacy';
  document.getElementById('sidebar-business-name').textContent = name;
  document.getElementById('header-business-name').textContent = name;
}

function getThreshold() {
  return safeNumber(state.settings.lowStockThreshold, 10);
}

function getProductStatus(product) {
  return Number(product.stock) < getThreshold() ? 'Low Stock' : 'In Stock';
}

function getExpiryStatus(product) {
  if (!product.expiryDate) return 'normal';
  const today = new Date();
  const expiry = new Date(product.expiryDate);
  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return daysLeft <= 45 ? 'warning' : 'normal';
}

function getRevenueTotal() {
  return state.transactions
    .filter((tx) => tx.status === 'Completed')
    .reduce((sum, tx) => sum + safeNumber(tx.total, 0), 0);
}

function getLowStockCount() {
  return state.inventory.filter((product) => Number(product.stock) < getThreshold()).length;
}

function getTransactionsTodayCount() {
  const today = new Date().toISOString().slice(0, 10);
  return state.transactions.filter((tx) => tx.status === 'Completed' && tx.date === today).length;
}

function getSalesTrend() {
  const list = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const iso = date.toISOString().slice(0, 10);
    const label = offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'short' });
    const total = state.transactions
      .filter((tx) => tx.status === 'Completed' && tx.date === iso)
      .reduce((sum, tx) => sum + safeNumber(tx.total, 0), 0);
    list.push({ label, total, iso });
  }
  return list;
}

function getRecentTransactions(limit = 5) {
  return [...state.transactions]
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
    .slice(0, limit);
}

function getProductById(productId) {
  return state.inventory.find((product) => product.id === productId);
}

function getFilteredInventory() {
  const term = (state.filters.inventorySearch || '').toLowerCase().trim();
  return state.inventory.filter((product) => {
    const matchesTerm = !term ||
      product.name.toLowerCase().includes(term) ||
      product.batchNumber.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term);
    const matchesCategory = state.filters.inventoryCategory === 'All' || product.category === state.filters.inventoryCategory;
    const status = getProductStatus(product);
    const matchesStatus = state.filters.inventoryStatus === 'All' ||
      (state.filters.inventoryStatus === 'low' && status === 'Low Stock') ||
      (state.filters.inventoryStatus === 'in' && status === 'In Stock');
    return matchesTerm && matchesCategory && matchesStatus;
  });
}

function getFilteredTransactions() {
  const term = (state.filters.transactionSearch || '').toLowerCase().trim();
  return [...state.transactions]
    .filter((tx) => {
      const matchesTerm = !term ||
        tx.id.toLowerCase().includes(term) ||
        tx.items.some((item) => item.productName.toLowerCase().includes(term));
      const matchesDate = !state.filters.transactionDate || tx.date === state.filters.transactionDate;
      return matchesTerm && matchesDate;
    })
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
}

function addNewProduct(payload) {
  const product = {
    id: `prod-${Date.now()}`,
    name: String(payload.name || '').trim(),
    batchNumber: String(payload.batchNumber || '').trim(),
    category: String(payload.category || '').trim(),
    stock: safeNumber(payload.stock, 0),
    expiryDate: String(payload.expiryDate || '').trim(),
    unitPrice: safeNumber(payload.unitPrice, 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!product.name || !product.batchNumber || !product.category || !product.expiryDate || product.stock < 0 || product.unitPrice < 0) {
    showToast('Please fill out all product fields correctly.');
    return false;
  }

  state.inventory.unshift(product);
  state.selectedProductId = product.id;
  persistState();
  render();
  showToast('Product added successfully.');
  return true;
}

function updateProduct(productId, payload) {
  const product = getProductById(productId);
  if (!product) return false;

  const next = {
    name: String(payload.name || '').trim(),
    batchNumber: String(payload.batchNumber || '').trim(),
    category: String(payload.category || '').trim(),
    stock: safeNumber(payload.stock, 0),
    expiryDate: String(payload.expiryDate || '').trim(),
    unitPrice: safeNumber(payload.unitPrice, 0),
  };

  if (!next.name || !next.batchNumber || !next.category || !next.expiryDate || next.stock < 0 || next.unitPrice < 0) {
    showToast('Please fill out all product fields correctly.');
    return false;
  }

  Object.assign(product, next, { updatedAt: new Date().toISOString() });
  persistState();
  render();
  showToast('Product updated successfully.');
  return true;
}

function deleteProduct(productId) {
  state.inventory = state.inventory.filter((item) => item.id !== productId);
  if (state.selectedProductId === productId) {
    state.selectedProductId = state.inventory[0]?.id || null;
  }
  persistState();
  render();
  showToast('Product deleted successfully.');
}

function handleAddToCart(productId, qty) {
  const product = getProductById(productId);
  if (!product) {
    showToast('Product not found.');
    return;
  }

  const quantity = safeNumber(qty, 1);
  if (quantity <= 0) {
    showToast('Quantity must be greater than zero.');
    return;
  }

  const existing = state.cart.find((item) => item.productId === productId);
  const totalRequested = (existing ? existing.quantity : 0) + quantity;
  if (totalRequested > Number(product.stock)) {
    showToast('Insufficient stock.');
    return;
  }

  if (existing) {
    existing.quantity = totalRequested;
  } else {
    state.cart.push({ productId: product.id, productName: product.name, quantity, unitPrice: product.unitPrice });
  }

  render();
}

function adjustCartItem(productId, delta) {
  const item = state.cart.find((entry) => entry.productId === productId);
  if (!item) return;

  const product = getProductById(productId);
  const nextQty = item.quantity + delta;

  if (nextQty <= 0) {
    state.cart = state.cart.filter((entry) => entry.productId !== productId);
    render();
    return;
  }

  if (product && nextQty > Number(product.stock)) {
    showToast('Insufficient stock.');
    return;
  }

  item.quantity = nextQty;
  render();
}

function removeCartItem(productId) {
  state.cart = state.cart.filter((entry) => entry.productId !== productId);
  render();
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function completeSale() {
  if (!state.cart.length) {
    showToast('Your cart is empty.');
    return;
  }

  for (const item of state.cart) {
    const product = getProductById(item.productId);
    if (!product || item.quantity > Number(product.stock)) {
      showToast('Insufficient stock.');
      return;
    }
  }

  const now = new Date();
  const items = state.cart.map((item) => {
    const subtotal = item.quantity * item.unitPrice;
    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal,
    };
  });

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  state.cart.forEach((item) => {
    const product = getProductById(item.productId);
    if (product) {
      product.stock = Number(product.stock) - Number(item.quantity);
      product.updatedAt = new Date().toISOString();
    }
  });

  const transaction = {
    id: `TX-${Date.now().toString().slice(-7)}`,
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    items,
    total,
    status: 'Completed',
    createdAt: now.toISOString(),
  };

  state.transactions.unshift(transaction);
  state.cart = [];
  persistState();
  render();
  showReceiptModal(transaction);
  showToast('Sale completed successfully.');
}

function renderOverviewPage() {
  const revenue = getRevenueTotal();
  const lowStockCount = getLowStockCount();
  const totalProducts = state.inventory.length;
  const transactionsToday = getTransactionsTodayCount();
  const trend = getSalesTrend();
  const maxTrend = Math.max(...trend.map((d) => d.total), 1);
  const lowStockAlerts = state.inventory.filter((product) => Number(product.stock) < getThreshold());
  const recentTransactions = getRecentTransactions(5);

  appContent.innerHTML = `
    <section class="page active">
      <div class="page-header">
        <div>
          <h1>Overview</h1>
          <div class="page-subtitle">Monitor your pharmacy operations at a glance.</div>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Total Revenue</div>
          <div class="metric-value">${formatCurrency(revenue)}</div>
          <div class="metric-meta">Calculate from completed sales</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Low Stock</div>
          <div class="metric-value">${lowStockCount}</div>
          <div class="metric-meta">Below ${getThreshold()} units</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Products</div>
          <div class="metric-value">${totalProducts}</div>
          <div class="metric-meta">Products in inventory</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Transactions Today</div>
          <div class="metric-value">${transactionsToday}</div>
          <div class="metric-meta">Completed today</div>
        </div>
      </div>

      <div class="two-col">
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">Sales Trend</h3>
          </div>
          <div class="sales-chart">
            ${trend.map((day) => `
              <div class="bar-group" title="${day.label}: ${formatCurrency(day.total)}">
                <div class="bar-value">${formatCurrency(day.total)}</div>
                <div class="bar" style="height:${Math.max((day.total / maxTrend) * 100, 8)}%"></div>
                <div class="bar-label">${day.label}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">Low Stock Alerts</h3>
          </div>
          <div class="alert-list">
            ${lowStockAlerts.length ? lowStockAlerts.map((product) => `
              <div class="alert-item">
                <div>
                  <div class="alert-item-name">${product.name}</div>
                  <div class="alert-item-meta">${product.stock} units remaining</div>
                </div>
                <span class="alert-pill">Low Stock</span>
              </div>
            `).join('') : '<div class="empty-state">All inventory levels are currently healthy.</div>'}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">Recent Transactions</h3>
        </div>
        <div class="transaction-list">
          ${recentTransactions.length ? recentTransactions.map((tx) => `
            <div class="transaction-item">
              <div>
                <div class="tx-id">${tx.id}</div>
                <div class="tx-meta">${formatDate(tx.date)} • ${tx.time}</div>
              </div>
              <div>
                <div class="tx-meta">Items</div>
                <div>${tx.items.reduce((sum, item) => sum + item.quantity, 0)}</div>
              </div>
              <div>
                <div class="tx-meta">Total</div>
                <div>${formatCurrency(tx.total)}</div>
              </div>
              <div>
                <div class="tx-meta">Status</div>
                <div>${tx.status}</div>
              </div>
              <div>
                <button class="small-link" data-open-transaction="${tx.id}" type="button">Open</button>
              </div>
              <div class="status-tag">${tx.status}</div>
            </div>
          `).join('') : '<div class="empty-state">No recent transactions.</div>'}
        </div>
      </div>
    </section>
  `;

  bindOpenTransactionLinks();
}

function renderInventoryPage() {
  const filtered = getFilteredInventory();

  appContent.innerHTML = `
    <section class="page active">
      <div class="page-header">
        <div>
          <h1>Inventory</h1>
        </div>
        <button class="page-action" data-open-product-modal="add" type="button">+ Add New Product</button>
      </div>

      <div class="toolbar">
        <input class="search-box" type="search" placeholder="Search by name, batch number or category" value="${escapeHtml(state.filters.inventorySearch)}" data-inventory-search />
        <select class="select-box" data-inventory-category>
          <option value="All" ${state.filters.inventoryCategory === 'All' ? 'selected' : ''}>All Categories</option>
          ${CATEGORY_OPTIONS.map((category) => `
            <option value="${category}" ${state.filters.inventoryCategory === category ? 'selected' : ''}>${category}</option>
          `).join('')}
        </select>
        <select class="select-box" data-inventory-status>
          <option value="All" ${state.filters.inventoryStatus === 'All' ? 'selected' : ''}>All Stock Status</option>
          <option value="low" ${state.filters.inventoryStatus === 'low' ? 'selected' : ''}>Low Stock</option>
          <option value="in" ${state.filters.inventoryStatus === 'in' ? 'selected' : ''}>In Stock</option>
        </select>
      </div>

      <div class="inventory-table-wrap">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Batch Number</th>
              <th>Category</th>
              <th>Stock Level</th>
              <th>Expiry Date</th>
              <th>Unit Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length ? filtered.map((product) => {
              const status = getProductStatus(product);
              const expiry = getExpiryStatus(product) === 'warning' ? 'Expiring Soon' : 'Healthy';
              return `
                <tr class="${status === 'Low Stock' ? 'low-stock' : ''}">
                  <td>${product.name}</td>
                  <td>${product.batchNumber}</td>
                  <td>${product.category}</td>
                  <td>${product.stock}</td>
                  <td>
                    <div>${formatDate(product.expiryDate)}</div>
                    <span class="expiry-badge ${expiry === 'Expiring Soon' ? 'warning' : 'normal'}">${expiry}</span>
                  </td>
                  <td>${formatCurrency(product.unitPrice)}</td>
                  <td><span class="stock-badge ${status === 'Low Stock' ? 'low-stock' : 'in-stock'}">${status}</span></td>
                  <td>
                    <div class="row-actions">
                      <button class="inline-action" type="button" data-edit-product="${product.id}">Edit</button>
                      <button class="inline-action danger" type="button" data-delete-product="${product.id}">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="8"><div class="empty-state">No products found.</div></td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </section>
  `;

  bindInventoryControls();
}

function bindInventoryControls() {
  document.querySelector('[data-open-product-modal="add"]')?.addEventListener('click', () => showProductModal());

  document.querySelector('[data-inventory-search]')?.addEventListener('input', (event) => {
    state.filters.inventorySearch = event.target.value;
    renderInventoryPage();
  });

  document.querySelector('[data-inventory-category]')?.addEventListener('change', (event) => {
    state.filters.inventoryCategory = event.target.value;
    renderInventoryPage();
  });

  document.querySelector('[data-inventory-status]')?.addEventListener('change', (event) => {
    state.filters.inventoryStatus = event.target.value;
    renderInventoryPage();
  });

  document.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = getProductById(button.dataset.editProduct);
      if (product) showProductModal(product);
    });
  });

  document.querySelectorAll('[data-delete-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = getProductById(button.dataset.deleteProduct);
      if (product) showDeleteModal(product.id, product.name);
    });
  });
}

function renderPosPage() {
  const productList = [...state.inventory].sort((a, b) => a.name.localeCompare(b.name));
  const selectedProduct = productList.find((product) => product.id === state.selectedProductId) || productList[0] || null;

  appContent.innerHTML = `
    <section class="page active">
      <div class="page-header">
        <div>
          <h1>Sales / POS</h1>
        </div>
      </div>

      <div class="pos-layout">
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">Select Product</h3>
          </div>
          <input class="search-box" id="pos-search" type="search" placeholder="Search product by name or batch" />
          <div class="product-list" id="pos-product-list">
            ${productList.length ? productList.map((product) => `
              <button class="product-choice ${selectedProduct && selectedProduct.id === product.id ? 'selected' : ''}" data-select-product="${product.id}" type="button">
                <div>
                  <div class="product-name">${product.name}</div>
                  <div class="product-meta">Stock: ${product.stock} • Batch: ${product.batchNumber}</div>
                </div>
                <div class="product-mini-price">${formatCurrency(product.unitPrice)}</div>
              </button>
            `).join('') : '<div class="empty-state">No products available.</div>'}
          </div>

          ${selectedProduct ? `
            <div class="pos-controls">
              <div class="form-field">
                <label class="label" for="pos-qty">Quantity</label>
                <input id="pos-qty" class="number-field" type="number" min="1" max="${selectedProduct.stock}" value="1" />
              </div>
              <div class="form-field">
                <label class="label" for="pos-price">Unit Price</label>
                <input id="pos-price" class="number-field" type="text" value="${formatCurrency(selectedProduct.unitPrice)}" readonly />
              </div>
              <div class="form-field" style="display:flex; align-items:end;">
                <button class="primary-button" id="add-to-cart-btn" type="button">Add to Cart</button>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="pos-cart">
          <div class="panel-header">
            <h3 class="panel-title">Cart</h3>
          </div>

          ${state.cart.length ? `
            <div class="cart-list">
              ${state.cart.map((item) => `
                <div class="cart-item">
                  <div class="cart-row-top">
                    <div class="product-name">${item.productName}</div>
                    <button class="inline-action danger" data-remove-cart="${item.productId}" type="button">Remove</button>
                  </div>
                  <div class="cart-row-bottom">
                    <div class="qty-adjust">
                      <button data-adjust-cart="${item.productId}" data-delta="-1" type="button">−</button>
                      <span>${item.quantity}</span>
                      <button data-adjust-cart="${item.productId}" data-delta="1" type="button">+</button>
                    </div>
                    <div>${formatCurrency(item.unitPrice)}</div>
                  </div>
                  <div class="cart-row-bottom">
                    <div class="product-meta">Subtotal</div>
                    <strong>${formatCurrency(item.quantity * item.unitPrice)}</strong>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="total-line">
              <span>Total</span>
              <span>${formatCurrency(getCartTotal())}</span>
            </div>
            <button class="pos-button" id="complete-sale-btn" type="button">Complete Sale</button>
          ` : '<div class="empty-state">Your cart is empty.</div>'}
        </div>
      </div>
    </section>
  `;

  bindPosControls();
}

function bindPosControls() {
  document.querySelectorAll('[data-select-product]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedProductId = button.dataset.selectProduct;
      renderPosPage();
    });
  });

  document.getElementById('pos-search')?.addEventListener('input', (event) => {
    const term = event.target.value.toLowerCase().trim();
    const matches = state.inventory.filter((product) =>
      product.name.toLowerCase().includes(term) || product.batchNumber.toLowerCase().includes(term)
    );

    const listEl = document.getElementById('pos-product-list');
    if (!listEl) return;

    listEl.innerHTML = matches.length ? matches.map((product) => `
      <button class="product-choice ${state.selectedProductId === product.id ? 'selected' : ''}" data-select-product="${product.id}" type="button">
        <div>
          <div class="product-name">${product.name}</div>
          <div class="product-meta">Stock: ${product.stock} • Batch: ${product.batchNumber}</div>
        </div>
        <div class="product-mini-price">${formatCurrency(product.unitPrice)}</div>
      </button>
    `).join('') : '<div class="empty-state">No products found.</div>';

    document.querySelectorAll('[data-select-product]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedProductId = button.dataset.selectProduct;
        renderPosPage();
      });
    });
  });

  document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
    handleAddToCart(state.selectedProductId, document.getElementById('pos-qty')?.value || 1);
  });

  document.querySelectorAll('[data-adjust-cart]').forEach((button) => {
    button.addEventListener('click', () => {
      adjustCartItem(button.dataset.adjustCart, safeNumber(button.dataset.delta, 1));
    });
  });

  document.querySelectorAll('[data-remove-cart]').forEach((button) => {
    button.addEventListener('click', () => removeCartItem(button.dataset.removeCart));
  });

  document.getElementById('complete-sale-btn')?.addEventListener('click', completeSale);
}

function renderTransactionsPage() {
  const filtered = getFilteredTransactions();

  appContent.innerHTML = `
    <section class="page active">
      <div class="page-header">
        <div>
          <h1>Transactions</h1>
        </div>
      </div>

      <div class="toolbar">
        <input class="search-box" type="search" placeholder="Search by transaction ID or product" value="${escapeHtml(state.filters.transactionSearch)}" data-transaction-search />
        <input class="date-input" type="date" value="${state.filters.transactionDate || ''}" data-transaction-date />
      </div>

      <div class="inventory-table-wrap">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Date</th>
              <th>Time</th>
              <th>Number of Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length ? filtered.map((tx) => `
              <tr>
                <td>${tx.id}</td>
                <td>${formatDate(tx.date)}</td>
                <td>${tx.time}</td>
                <td>${tx.items.reduce((count, item) => count + item.quantity, 0)}</td>
                <td>${formatCurrency(tx.total)}</td>
                <td><span class="status-tag">${tx.status}</span></td>
                <td><button class="inline-action" data-open-transaction="${tx.id}" type="button">View</button></td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="7"><div class="empty-state">No transactions yet.</div></td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </section>
  `;

  bindTransactionFilters();
}

function bindTransactionFilters() {
  document.querySelector('[data-transaction-search]')?.addEventListener('input', (event) => {
    state.filters.transactionSearch = event.target.value;
    renderTransactionsPage();
  });

  document.querySelector('[data-transaction-date]')?.addEventListener('change', (event) => {
    state.filters.transactionDate = event.target.value;
    renderTransactionsPage();
  });

  bindOpenTransactionLinks();
}

function bindOpenTransactionLinks() {
  document.querySelectorAll('[data-open-transaction]').forEach((button) => {
    button.addEventListener('click', () => {
      const tx = state.transactions.find((item) => item.id === button.dataset.openTransaction);
      if (tx) showTransactionModal(tx);
    });
  });
}

function renderSettingsPage() {
  appContent.innerHTML = `
    <section class="page active">
      <div class="page-header">
        <div>
          <h1>Settings</h1>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">Business Information</h3>
        </div>

        <form id="settings-form">
          <div class="form-grid">
            <div class="form-field">
              <label class="label" for="business-name">Business Name</label>
              <input id="business-name" type="text" value="${escapeHtml(state.business.name)}" />
            </div>
            <div class="form-field">
              <label class="label" for="currency">Currency</label>
              <input id="currency" type="text" value="${escapeHtml(state.settings.currency)}" />
            </div>
            <div class="form-field full">
              <label class="label" for="threshold">Low Stock Threshold</label>
              <input id="threshold" type="number" min="1" value="${safeNumber(state.settings.lowStockThreshold, 10)}" />
            </div>
          </div>

          <div class="modal-footer" style="padding-left:0; padding-right:0; padding-top:20px;">
            <button type="submit" class="primary-button">Save Settings</button>
          </div>
        </form>
      </div>
    </section>
  `;

  document.getElementById('settings-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const businessName = document.getElementById('business-name').value.trim();
    const currency = document.getElementById('currency').value.trim();
    const threshold = safeNumber(document.getElementById('threshold').value, 10);

    if (!businessName || !currency || threshold <= 0) {
      showToast('Please complete all settings fields correctly.');
      return;
    }

    state.business.name = businessName;
    state.settings.currency = currency;
    state.settings.lowStockThreshold = threshold;
    persistState();
    updateBusinessNames();
    render();
    showToast('Settings saved successfully.');
  });
}

function showProductModal(product = null) {
  const isEdit = Boolean(product);
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
          <button class="close-button" type="button" aria-label="Close" data-close-modal>×</button>
        </div>
        <div class="modal-body">
          <form id="product-form">
            <div class="form-grid">
              <div class="form-field">
                <label class="label" for="product-name">Product Name</label>
                <input id="product-name" type="text" value="${escapeHtml(product?.name || '')}" required />
              </div>
              <div class="form-field">
                <label class="label" for="batch-number">Batch Number</label>
                <input id="batch-number" type="text" value="${escapeHtml(product?.batchNumber || '')}" required />
              </div>
              <div class="form-field">
                <label class="label" for="product-category">Category</label>
                <select id="product-category" required>
                  ${CATEGORY_OPTIONS.map((category) => `
                    <option value="${category}" ${product && product.category === category ? 'selected' : ''}>${category}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-field">
                <label class="label" for="stock-level">Stock Level</label>
                <input id="stock-level" type="number" min="0" value="${safeNumber(product?.stock, 0)}" required />
              </div>
              <div class="form-field">
                <label class="label" for="expiry-date">Expiry Date</label>
                <input id="expiry-date" type="date" value="${product?.expiryDate || ''}" required />
              </div>
              <div class="form-field">
                <label class="label" for="unit-price">Unit Price</label>
                <input id="unit-price" type="number" min="0" step="1" value="${safeNumber(product?.unitPrice, 0)}" required />
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="secondary-button" data-close-modal>Cancel</button>
              <button type="submit" class="primary-button">${isEdit ? 'Save Changes' : 'Add Product'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('product-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = {
      name: document.getElementById('product-name').value,
      batchNumber: document.getElementById('batch-number').value,
      category: document.getElementById('product-category').value,
      stock: document.getElementById('stock-level').value,
      expiryDate: document.getElementById('expiry-date').value,
      unitPrice: document.getElementById('unit-price').value,
    };

    if (product) {
      updateProduct(product.id, payload);
    } else {
      addNewProduct(payload);
    }

    closeModal();
  });

  modalRoot.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
}

function showDeleteModal(productId, productName) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>Delete Product</h3>
          <button class="close-button" type="button" aria-label="Close" data-close-modal>×</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete this product?</p>
          <p><strong>${escapeHtml(productName)}</strong></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="secondary-button" data-close-modal>Cancel</button>
          <button type="button" class="danger-button" data-confirm-delete="${productId}">Delete</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector('[data-confirm-delete]')?.addEventListener('click', () => {
    deleteProduct(productId);
    closeModal();
  });

  modalRoot.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
}

function showTransactionModal(transaction) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>Transaction Details</h3>
          <button class="close-button" type="button" aria-label="Close" data-close-modal>×</button>
        </div>
        <div class="modal-body">
          <div class="receipt-box">
            <div class="receipt-brand">
              <h2>${escapeHtml(state.business.name)}</h2>
              <p>Pharmacy Operations</p>
            </div>
            <div class="receipt-meta">
              <div><strong>Receipt Number:</strong> ${transaction.id}</div>
              <div><strong>Date:</strong> ${formatDate(transaction.date)}</div>
              <div><strong>Time:</strong> ${transaction.time}</div>
            </div>
            <table class="receipt-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th class="amount">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${transaction.items.map((item) => `
                  <tr>
                    <td>${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td class="amount">${formatCurrency(item.subtotal)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="receipt-total">
              <span>TOTAL</span>
              <span>${formatCurrency(transaction.total)}</span>
            </div>
            <div class="receipt-footer">
              <div>Prototype — Demo Data</div>
              <div>Powered by AYASYN</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="secondary-button" data-close-modal>Close</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
}

function showReceiptModal(transaction) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>Receipt</h3>
          <button class="close-button" type="button" aria-label="Close" data-close-modal>×</button>
        </div>
        <div class="modal-body">
          <div class="receipt-box">
            <div class="receipt-brand">
              <h2>${escapeHtml(state.business.name)}</h2>
              <p>Pharmacy Operations</p>
            </div>
            <div class="receipt-meta">
              <div><strong>Receipt Number:</strong> ${transaction.id}</div>
              <div><strong>Date:</strong> ${formatDate(transaction.date)}</div>
              <div><strong>Time:</strong> ${transaction.time}</div>
            </div>
            <table class="receipt-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th class="amount">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${transaction.items.map((item) => `
                  <tr>
                    <td>${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td class="amount">${formatCurrency(item.subtotal)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="receipt-total">
              <span>TOTAL</span>
              <span>${formatCurrency(transaction.total)}</span>
            </div>
            <div class="receipt-footer">
              <div>Prototype — Demo Data</div>
              <div>Powered by AYASYN</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="secondary-button" data-close-modal>Close</button>
          <button type="button" class="primary-button" id="print-receipt-btn">Print Receipt</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('print-receipt-btn')?.addEventListener('click', () => window.print());
  modalRoot.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
}

function closeModal() {
  modalRoot.innerHTML = '';
}

function render() {
  updateBusinessNames();
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === state.currentPage);
  });

  if (state.currentPage === 'overview') renderOverviewPage();
  else if (state.currentPage === 'inventory') renderInventoryPage();
  else if (state.currentPage === 'pos') renderPosPage();
  else if (state.currentPage === 'transactions') renderTransactionsPage();
  else if (state.currentPage === 'settings') renderSettingsPage();
}

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    state.currentPage = button.dataset.page;
    render();
    sidebar.classList.remove('open');
  });
});

mobileToggle?.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

window.addEventListener('click', (event) => {
  if (event.target instanceof HTMLElement && event.target.matches('[data-close-modal]')) {
    closeModal();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  ensureDefaultData();
  updateBusinessNames();
  render();
});
