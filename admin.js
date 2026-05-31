// ============================================
// B HAN - Admin Panel
// ============================================

const A = {
  loggedIn: false,
  tab: 'dashboard',     // dashboard | orders | products | coupons | customers | settings
  products: [],
  orders: [],
  coupons: [],
  customers: [],
  settings: { ...STORE_DEFAULTS },
  editingProduct: null,
  editingCoupon: null,
  viewingOrder: null,
  loginErr: ''
};

// ====== UTIL ======
function $a(id){ return document.getElementById(id); }
function escA(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmtA(n){ return '৳' + Number(n||0).toLocaleString('en-IN'); }
function dateA(ts){
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function toastA(msg, err){
  const t = document.createElement('div');
  t.className = 'toast' + (err?' err':'');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ try{ document.body.removeChild(t); }catch(e){} }, 2400);
}

// ====== AUTH (admin password — hashed, rate-limited) ======
let _adminAttempts = [];
async function login(pw){
  // Rate limit: 5 attempts per 5 minutes
  const now = Date.now();
  _adminAttempts = _adminAttempts.filter(t => now - t < 300000);
  if (_adminAttempts.length >= 5) {
    const wait = Math.ceil((300000 - (now - _adminAttempts[0])) / 1000);
    A.loginErr = 'Too many attempts. Wait ' + wait + 's';
    renderLogin();
    return;
  }
  _adminAttempts.push(now);

  const ok = await verifyAdminPassword(pw);
  if (ok) {
    A.loggedIn = true;
    A.loginErr = '';
    // Session token with expiry (4 hours)
    try {
      sessionStorage.setItem('bhan_admin', JSON.stringify({ ts: Date.now() }));
    } catch(e){}
    boot();
  } else {
    A.loginErr = 'Incorrect password';
    renderLogin();
  }
}
function logout(){
  A.loggedIn = false;
  try { sessionStorage.removeItem('bhan_admin'); } catch(e){}
  renderLogin();
}

function renderLogin(){
  $a('app').innerHTML = `
    <div class="login-pg">
      <div class="login-card">
        <div class="login-logo">B</div>
        <div class="login-title">B HAN Admin</div>
        <div class="login-sub">Enter password to continue</div>
        ${A.loginErr ? `<div class="login-err">${escA(A.loginErr)}</div>` : ''}
        <input id="pw-input" class="login-input" type="password" placeholder="Password" onkeydown="if(event.key==='Enter')login(this.value)"/>
        <button class="login-btn" onclick="login(document.getElementById('pw-input').value)">Sign In</button>
      </div>
    </div>
  `;
  setTimeout(()=>{ const i=$a('pw-input'); if(i) i.focus(); }, 100);
}

// ====== BOOT ======
async function boot(){
  $a('app').innerHTML = '<div style="padding:60px;text-align:center;color:#888">Loading...</div>';
  const [products, orders, coupons, settings, customers] = await Promise.all([
    Store.getProducts(),
    Store.getOrders(),
    Store.getCoupons(),
    Store.getSettings(),
    Store.getCustomers()
  ]);
  A.products = products;
  A.orders = orders;
  A.coupons = coupons;
  A.settings = { ...STORE_DEFAULTS, ...settings };
  A.customers = customers;
  renderApp();
}

// ====== TABS ======
function setTab(t){ A.tab = t; A.editingProduct = null; A.editingCoupon = null; A.viewingOrder = null; renderApp(); }

function renderApp(){
  const body =
    A.tab === 'dashboard' ? renderDashboard() :
    A.tab === 'orders'    ? renderOrders() :
    A.tab === 'products'  ? renderProducts() :
    A.tab === 'coupons'   ? renderCoupons() :
    A.tab === 'customers' ? renderCustomers() :
    A.tab === 'settings'  ? renderSettings() :
    '';

  $a('app').innerHTML = `
    <div class="app">
      <div class="header">
        <div class="alogo">
          <div class="alogo-mark">B</div>
          <div>
            <div class="alogo-text">B HAN</div>
            <div class="alogo-sub">Admin Panel</div>
          </div>
        </div>
        <div style="display:flex;align-items:center">
          <span class="live-badge">● ${useFirebase ? 'LIVE' : 'OFFLINE'}</span>
          <button class="logout-btn" onclick="logout()">Logout</button>
        </div>
      </div>
      <div class="tabs">
        ${tabBtn('dashboard','📊','Dashboard')}
        ${tabBtn('orders','📦','Orders')}
        ${tabBtn('products','✨','Products')}
        ${tabBtn('coupons','🎟️','Coupons')}
        ${tabBtn('customers','👥','Customers')}
        ${tabBtn('settings','⚙️','Settings')}
      </div>
      <div class="body">${body}</div>
    </div>
  `;
}
function tabBtn(t, icon, name){
  return `<button class="tab ${A.tab===t?'on':''}" onclick="setTab('${t}')">${icon} ${name}</button>`;
}

// ====== DASHBOARD ======
function renderDashboard(){
  const totalRevenue = A.orders.reduce((s,o) => s + (o.total||0), 0);
  const pending = A.orders.filter(o => (o.status||'pending') === 'pending').length;
  const customers = A.customers.length;

  return `
    <div class="sect-hd">
      <div>
        <div class="sect-title">Dashboard</div>
        <div class="sect-sub">Live overview · ${useFirebase?'Firebase':'localStorage only'}</div>
      </div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-icon">💰</div>
        <div class="stat-lbl">REVENUE</div>
        <div class="stat-val">${fmtA(totalRevenue)}</div>
        <div class="stat-sub">All time</div>
      </div>
      <div class="stat" style="border-left-color:#7c3aed">
        <div class="stat-icon">📦</div>
        <div class="stat-lbl">ORDERS</div>
        <div class="stat-val">${A.orders.length}</div>
        <div class="stat-sub">${pending} pending</div>
      </div>
      <div class="stat" style="border-left-color:#22c55e">
        <div class="stat-icon">✨</div>
        <div class="stat-lbl">PRODUCTS</div>
        <div class="stat-val">${A.products.length}</div>
        <div class="stat-sub">${A.products.filter(p=>p.featured).length} featured</div>
      </div>
      <div class="stat" style="border-left-color:#0891b2">
        <div class="stat-icon">👥</div>
        <div class="stat-lbl">CUSTOMERS</div>
        <div class="stat-val">${customers}</div>
        <div class="stat-sub">Unique buyers</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📦 Recent Orders</div>
      ${A.orders.slice(0,5).map(orderRowHtml).join('') || '<div class="empty"><div class="empty-icon">📭</div><div class="empty-msg">No orders yet</div></div>'}
    </div>
  `;
}

// ====== ORDERS ======
function statusChipClass(s){
  return ({pending:'s-pending',confirmed:'s-confirmed',processing:'s-processing',shipped:'s-shipped',delivered:'s-delivered',cancelled:'s-cancelled'})[s||'pending'] || 's-pending';
}
function orderRowHtml(o){
  const trk = TRACKING_STATUSES.find(s => s.key === (o.trackingStatus||'received'));
  return `
    <div class="order" onclick="viewOrder('${escA(o.id)}')">
      <div class="order-hd">
        <div>
          <div class="order-cust">${escA((o.customer&&o.customer.name)||'—')}</div>
          <div class="order-id">${escA(o.id)} · ${dateA(o.createdAt)}</div>
        </div>
        <div class="status-tag ${statusChipClass(o.status)}">${escA(o.status||'pending')}</div>
      </div>
      <div class="order-ft">
        <div>${(o.items||[]).length} items · ${trk ? trk.icon + ' ' + trk.label : 'Order Received'}</div>
        <div class="order-total">${fmtA(o.total)}</div>
      </div>
    </div>
  `;
}

function renderOrders(){
  if (A.viewingOrder) return renderOrderDetail();
  return `
    <div class="sect-hd">
      <div>
        <div class="sect-title">Orders</div>
        <div class="sect-sub">${A.orders.length} total</div>
      </div>
    </div>
    ${A.orders.length ? A.orders.map(orderRowHtml).join('') : '<div class="empty"><div class="empty-icon">📭</div><div class="empty-msg">No orders yet</div></div>'}
  `;
}

function viewOrder(id){
  A.viewingOrder = A.orders.find(o => o.id === id);
  renderApp();
}
function backToOrders(){ A.viewingOrder = null; renderApp(); }

function renderOrderDetail(){
  const o = A.viewingOrder;
  if (!o) return '';
  const cust = o.customer || {};
  const phone = (cust.phone || '').replace(/[^0-9+]/g,'');
  const trkOpts = TRACKING_STATUSES.map(s =>
    `<option value="${s.key}" ${o.trackingStatus===s.key?'selected':''}>${s.icon} ${s.label}</option>`
  ).join('');

  const historyHtml = (o.statusHistory||[]).slice().reverse().map(h => {
    const def = TRACKING_STATUSES.find(s => s.key === h.status);
    return `
      <div style="padding:10px 0;border-bottom:1px solid #f5f5f5">
        <div style="font-size:12px;font-weight:800">${def ? def.icon + ' ' + def.label : escA(h.status)}</div>
        <div style="font-size:10.5px;color:#888;margin-top:2px">${dateA(h.ts)}</div>
        ${h.note ? `<div style="font-size:11.5px;color:#444;margin-top:4px;background:#fafafa;padding:6px 9px;border-radius:6px">${escA(h.note)}</div>`:''}
      </div>
    `;
  }).join('');

  return `
    <div class="sect-hd">
      <div>
        <button onclick="backToOrders()" style="font-size:12px;color:#888;font-weight:700">← Back to orders</button>
        <div class="sect-title">Order ${escA(o.id)}</div>
        <div class="sect-sub">${dateA(o.createdAt)}</div>
      </div>
      <div class="status-tag ${statusChipClass(o.status)}">${escA(o.status||'pending')}</div>
    </div>

    <div class="form-card">
      <div class="form-title">👤 Customer</div>
      <div class="det-customer">
        <div class="det-c-row"><strong>${escA(cust.name||'—')}</strong></div>
        <div class="det-c-row">📱 ${escA(cust.phone||'—')}</div>
        <div class="det-c-row">📍 ${escA(cust.address||'—')}</div>
        <div class="det-c-row">🚚 ${cust.area==='outside'?'Outside Dhaka':'Inside Dhaka'}</div>
        ${o.payment ? `<div class="det-c-row">💳 ${escA(o.payment.method||'').toUpperCase()} · sent via ${escA(o.payment.sentVia||'—')}</div>` : ''}
        <div class="contact-btns">
          ${phone ? `<a class="btn-call" href="tel:${escA(phone)}">📞 Call</a>` : ''}
          ${phone ? `<a class="btn-wa" href="https://wa.me/${escA(phone.replace(/^\+/,''))}" target="_blank">💬 WhatsApp</a>` : ''}
        </div>
      </div>
    </div>

    <div class="form-card">
      <div class="form-title">🚚 Update Tracking Status</div>
      <label class="label">Current Status</label>
      <select class="input" id="trk-status">${trkOpts}</select>
      <label class="label">Tracking Note (optional)</label>
      <textarea class="input textarea" id="trk-note" placeholder="e.g., Package picked by EMS, tracking #EE123456789KR">${escA(o.trackingNote||'')}</textarea>
      <button class="save-btn" onclick="saveTracking('${escA(o.id)}')">💾 Update Tracking</button>
    </div>

    <div class="form-card">
      <div class="form-title">📋 Order Status</div>
      <div class="status-grid">
        ${['pending','confirmed','processing','shipped','delivered','cancelled'].map(st =>
          `<button class="status-btn ${o.status===st?'on':''}" onclick="updateOrderStatus('${escA(o.id)}','${st}')">${st}</button>`
        ).join('')}
      </div>
    </div>

    <div class="form-card">
      <div class="form-title">📦 Items (${(o.items||[]).length})</div>
      ${(o.items||[]).map(it => `
        <div class="itm">
          <div class="itm-img">${it.image?`<img src="${escA(it.image)}"/>`:'✨'}</div>
          <div class="itm-info">
            <div class="itm-name">${escA(it.name)}</div>
            <div class="itm-meta">${it.qty} × ${fmtA(it.price)}</div>
          </div>
          <div class="itm-price">${fmtA((it.price||0)*(it.qty||0))}</div>
        </div>
      `).join('')}
      <div style="margin-top:12px;padding-top:12px;border-top:1px dashed #eee">
        <div class="det-c-row" style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmtA(o.subtotal)}</span></div>
        <div class="det-c-row" style="display:flex;justify-content:space-between"><span>Shipping</span><span>${fmtA(o.shipping)}</span></div>
        ${o.discount ? `<div class="det-c-row" style="display:flex;justify-content:space-between;color:#22c55e"><span>Discount</span><span>-${fmtA(o.discount)}</span></div>`:''}
        <div class="det-c-row" style="display:flex;justify-content:space-between;font-weight:900;font-size:15px;margin-top:6px"><span>Total</span><span>${fmtA(o.total)}</span></div>
      </div>
    </div>

    <div class="form-card">
      <div class="form-title">📜 Status History</div>
      ${historyHtml || '<div style="color:#bbb;font-size:12px">No history yet</div>'}
    </div>
  `;
}

async function saveTracking(orderId){
  const status = $a('trk-status').value;
  const note = $a('trk-note').value;
  const updates = await Store.updateTracking(orderId, status, note);
  // Reflect locally
  const idx = A.orders.findIndex(o => o.id === orderId);
  if (idx >= 0) A.orders[idx] = { ...A.orders[idx], ...updates };
  if (A.viewingOrder && A.viewingOrder.id === orderId) A.viewingOrder = A.orders[idx];
  toastA('✓ Tracking updated');
  renderApp();
}

async function updateOrderStatus(orderId, status){
  await Store.updateOrderStatus(orderId, status);
  const idx = A.orders.findIndex(o => o.id === orderId);
  if (idx >= 0) A.orders[idx].status = status;
  if (A.viewingOrder && A.viewingOrder.id === orderId) A.viewingOrder = A.orders[idx];
  toastA('✓ Status updated');
  renderApp();
}

// ====== PRODUCTS ======
function renderProducts(){
  if (A.editingProduct !== null) return renderProductForm();
  return `
    <div class="sect-hd">
      <div>
        <div class="sect-title">Products</div>
        <div class="sect-sub">${A.products.length} items</div>
      </div>
      <button class="add-btn" onclick="newProduct()">＋ Add</button>
    </div>
    ${A.products.length ? A.products.map(p => `
      <div class="prod-card">
        <div class="prod-img">${(p.image || (p.images&&p.images[0])) ? `<img src="${escA(p.image||p.images[0])}"/>` : '✨'}</div>
        <div class="prod-info">
          <div class="prod-name">${escA(p.name)}</div>
          <div class="prod-meta">${escA(p.category||'')} ${p.featured?' · ⭐':''}</div>
          <div class="prod-price">${fmtA(p.price)}</div>
        </div>
        <div class="prod-actions">
          <button class="prod-edit" onclick="editProduct('${escA(p.id)}')">Edit</button>
          <button class="prod-del" onclick="deleteProduct('${escA(p.id)}')">×</button>
        </div>
      </div>
    `).join('') : '<div class="empty"><div class="empty-icon">✨</div><div class="empty-msg">No products yet</div></div>'}
  `;
}

function newProduct(){ A.editingProduct = { id:'', name:'', category:'Skincare', price:0, oldPrice:0, description:'', image:'', tags:[], featured:false, isNew:true, skinType:'', concern:'' }; renderApp(); }
function editProduct(id){ A.editingProduct = { ...(A.products.find(p=>p.id===id) || {}) }; renderApp(); }

function renderProductForm(){
  const p = A.editingProduct;
  const cats = (A.settings.categories || STORE_DEFAULTS.categories);
  return `
    <div class="sect-hd">
      <div>
        <button onclick="A.editingProduct=null;renderApp()" style="font-size:12px;color:#888;font-weight:700">← Back</button>
        <div class="sect-title">${p.id ? 'Edit Product' : 'New Product'}</div>
      </div>
    </div>
    <div class="form-card">
      <label class="label">Name</label>
      <input class="input" id="p-name" value="${escA(p.name||'')}"/>
      <label class="label">Category</label>
      <select class="input" id="p-cat">
        ${cats.map(c => `<option value="${escA(c)}" ${p.category===c?'selected':''}>${escA(c)}</option>`).join('')}
      </select>
      <div class="row2">
        <div>
          <label class="label">Price (৳)</label>
          <input class="input" id="p-price" type="number" value="${p.price||0}"/>
        </div>
        <div>
          <label class="label">Old Price (৳)</label>
          <input class="input" id="p-old" type="number" value="${p.oldPrice||0}"/>
        </div>
      </div>
      <label class="label">Product Image</label>
      <div class="img-uploader">
        <div class="img-preview" id="p-img-preview">
          ${p.image ? `<img src="${escA(p.image)}" alt="preview"/>` : '<span class="img-placeholder">📷</span>'}
        </div>
        <div class="img-actions">
          <label class="img-btn upload-btn">
            <input type="file" id="p-img-file" accept="image/*" style="display:none" onchange="uploadProductImage(event)"/>
            📤 Upload Photo
          </label>
          <button class="img-btn url-btn" type="button" onclick="toggleImgUrl()">🔗 Use URL</button>
        </div>
        <div id="p-img-url-row" style="display:none;margin-top:8px">
          <input class="input" id="p-img" value="${escA(p.image||'')}" placeholder="https://... or paste URL" oninput="previewImgUrl(this.value)"/>
        </div>
        <input type="hidden" id="p-img-hidden" value="${escA(p.image||'')}"/>
        <div id="p-img-progress" style="display:none;margin-top:8px;font-size:12px;color:#666;text-align:center"></div>
      </div>
      <label class="label">Description</label>
      <textarea class="input textarea" id="p-desc">${escA(p.description||'')}</textarea>
      <div class="row2">
        <div>
          <label class="label">Skin Type Match</label>
          <input class="input" id="p-skin" value="${escA(p.skinType||'')}" placeholder="oily, dry, combo, normal"/>
        </div>
        <div>
          <label class="label">Concern Match</label>
          <input class="input" id="p-concern" value="${escA(p.concern||'')}" placeholder="acne, aging, dullness..."/>
        </div>
      </div>
      <div class="row2">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700"><input type="checkbox" id="p-feat" ${p.featured?'checked':''}/> Featured ⭐</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700"><input type="checkbox" id="p-new" ${p.isNew?'checked':''}/> New 🌸</label>
      </div>
      <button class="save-btn" onclick="saveProduct()">💾 Save Product</button>
    </div>
  `;
}

async function saveProduct(){
  const p = A.editingProduct;
  p.name = $a('p-name').value.trim();
  p.category = $a('p-cat').value;
  p.price = parseInt($a('p-price').value) || 0;
  p.oldPrice = parseInt($a('p-old').value) || 0;
  // Image: prefer hidden (set by upload), fallback to visible URL input
  const hiddenImg = $a('p-img-hidden');
  const urlImg = $a('p-img');
  p.image = (hiddenImg && hiddenImg.value.trim()) || (urlImg && urlImg.value.trim()) || '';
  p.description = $a('p-desc').value.trim();
  p.skinType = $a('p-skin').value.trim();
  p.concern = $a('p-concern').value.trim();
  p.featured = $a('p-feat').checked;
  p.isNew = $a('p-new').checked;
  if (!p.name) { toastA('Name required', true); return; }
  const saved = await Store.saveProduct(p);
  const idx = A.products.findIndex(x => x.id === saved.id);
  if (idx >= 0) A.products[idx] = saved; else A.products.unshift(saved);
  A.editingProduct = null;
  toastA('✓ Saved');
  renderApp();
}

async function deleteProduct(id){
  if (!confirm('Delete this product?')) return;
  await Store.deleteProduct(id);
  A.products = A.products.filter(p => p.id !== id);
  toastA('Deleted');
  renderApp();
}

// ====== COUPONS ======
function renderCoupons(){
  if (A.editingCoupon !== null) return renderCouponForm();
  return `
    <div class="sect-hd">
      <div>
        <div class="sect-title">Coupons</div>
        <div class="sect-sub">${A.coupons.length} codes</div>
      </div>
      <button class="add-btn" onclick="newCoupon()">＋ Add</button>
    </div>
    ${A.coupons.length ? A.coupons.map(c => `
      <div class="cpn">
        <div class="cpn-left">
          <div class="cpn-icon">🎟️</div>
          <div>
            <div class="cpn-code">${escA(c.code)}</div>
            <div class="cpn-detail">${c.type==='percent'?c.value+'% off':fmtA(c.value)+' off'}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="cpn-active ${c.active===false?'cpn-inactive':''}">${c.active===false?'OFF':'ON'}</span>
          <button class="prod-edit" onclick="editCoupon('${escA(c.id)}')">Edit</button>
          <button class="prod-del" onclick="deleteCoupon('${escA(c.id)}')">×</button>
        </div>
      </div>
    `).join('') : '<div class="empty"><div class="empty-icon">🎟️</div><div class="empty-msg">No coupons yet</div></div>'}
  `;
}
function newCoupon(){ A.editingCoupon = { code:'', type:'percent', value:10, active:true }; renderApp(); }
function editCoupon(id){ A.editingCoupon = { ...(A.coupons.find(c=>c.id===id)||{}) }; renderApp(); }
function renderCouponForm(){
  const c = A.editingCoupon;
  return `
    <div class="sect-hd">
      <div>
        <button onclick="A.editingCoupon=null;renderApp()" style="font-size:12px;color:#888;font-weight:700">← Back</button>
        <div class="sect-title">${c.id?'Edit':'New'} Coupon</div>
      </div>
    </div>
    <div class="form-card">
      <label class="label">Code</label>
      <input class="input" id="c-code" value="${escA(c.code||'')}" style="text-transform:uppercase;letter-spacing:1px"/>
      <label class="label">Type</label>
      <select class="input" id="c-type">
        <option value="percent" ${c.type==='percent'?'selected':''}>Percent (%)</option>
        <option value="amount" ${c.type==='amount'?'selected':''}>Fixed Amount (৳)</option>
      </select>
      <label class="label">Value</label>
      <input class="input" id="c-val" type="number" value="${c.value||0}"/>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:10px"><input type="checkbox" id="c-act" ${c.active!==false?'checked':''}/> Active</label>
      <button class="save-btn" onclick="saveCoupon()">💾 Save Coupon</button>
    </div>
  `;
}
async function saveCoupon(){
  const c = A.editingCoupon;
  c.code = $a('c-code').value.trim().toUpperCase();
  c.type = $a('c-type').value;
  c.value = parseInt($a('c-val').value) || 0;
  c.active = $a('c-act').checked;
  if (!c.code) { toastA('Code required', true); return; }
  c.id = c.id || c.code;
  const saved = await Store.saveCoupon(c);
  const idx = A.coupons.findIndex(x => x.id === saved.id);
  if (idx >= 0) A.coupons[idx] = saved; else A.coupons.unshift(saved);
  A.editingCoupon = null;
  toastA('✓ Saved');
  renderApp();
}
async function deleteCoupon(id){
  if (!confirm('Delete this coupon?')) return;
  await Store.deleteCoupon(id);
  A.coupons = A.coupons.filter(c => c.id !== id);
  toastA('Deleted');
  renderApp();
}

// ====== CUSTOMERS ======
function renderCustomers(){
  return `
    <div class="sect-hd">
      <div>
        <div class="sect-title">Customers</div>
        <div class="sect-sub">${A.customers.length} registered users</div>
      </div>
    </div>
    ${A.customers.length ? A.customers.map(c => {
      const lastDate = c.lastOrder ? dateA(c.lastOrder) : 'No orders';
      const addr = c.address || (c.orders && c.orders.length && c.orders[0].customer ? c.orders[0].customer.address : '');
      const area = c.area || (c.orders && c.orders.length && c.orders[0].customer ? c.orders[0].customer.area : '');
      const areaLabel = area === 'outside' ? 'Outside Dhaka' : 'Inside Dhaka';
      return `
      <div class="card" style="margin-bottom:9px;cursor:pointer" onclick="this.querySelector('.cust-detail').style.display=this.querySelector('.cust-detail').style.display==='none'?'block':'none'">
        <div style="display:flex;gap:11px;align-items:center">
          <div class="prod-img" style="background:linear-gradient(135deg,#fff0f5,#f5e8ff);font-size:18px;width:48px;height:48px;border-radius:12px">${escA((c.name||'?').slice(0,1).toUpperCase())}</div>
          <div style="flex:1">
            <div class="prod-name" style="font-size:14px">${escA(c.name||'Customer')}</div>
            <div class="prod-meta">📱 ${escA(c.phone||'—')} · ${c.orderCount||0} orders · ${fmtA(c.totalSpent||0)}</div>
            <div class="prod-meta">Last: ${escA(lastDate)}</div>
          </div>
        </div>
        <div class="cust-detail" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed #eee">
          <div style="font-size:12px;color:#444;margin-bottom:4px"><strong>📍 Address:</strong> ${escA(addr||'Not provided')}</div>
          <div style="font-size:12px;color:#444;margin-bottom:4px"><strong>🚚 Area:</strong> ${escA(areaLabel)}</div>
          <div style="font-size:12px;color:#444;margin-bottom:4px"><strong>📅 Joined:</strong> ${c.createdAt ? dateA(c.createdAt) : '—'}</div>
          ${c.orders && c.orders.length ? `
            <div style="font-size:11px;font-weight:800;margin:10px 0 6px;letter-spacing:.3px;color:#888">RECENT ORDERS</div>
            ${c.orders.slice(0,5).map(o => `
              <div style="display:flex;justify-content:space-between;font-size:11.5px;padding:5px 0;border-bottom:1px solid #f5f5f5">
                <span style="font-family:monospace;color:#888">${escA(o.id)}</span>
                <span>${(o.items||[]).length} items</span>
                <span style="font-weight:900">${fmtA(o.total)}</span>
                <span class="status-tag ${statusChipClass(o.status)}" style="font-size:8px">${escA(o.status||'pending')}</span>
              </div>
            `).join('')}
          ` : '<div style="font-size:11px;color:#bbb;margin-top:8px">No orders yet</div>'}
          <div style="display:flex;gap:6px;margin-top:10px">
            ${c.phone ? `<a class="btn-call" href="tel:${escA(c.phone)}" onclick="event.stopPropagation()" style="flex:1;font-size:11px;padding:8px;border-radius:8px;text-align:center;border:1px solid #eee">📞 Call</a>` : ''}
            ${c.phone ? `<a class="btn-wa" href="https://wa.me/${escA(c.phone.replace(/^0/,'880'))}" target="_blank" onclick="event.stopPropagation()" style="flex:1;font-size:11px;padding:8px;border-radius:8px;text-align:center;background:#22c55e;color:#fff">💬 WhatsApp</a>` : ''}
          </div>
        </div>
      </div>`;
    }).join('') : '<div class="empty"><div class="empty-icon">👥</div><div class="empty-msg">No customers yet</div></div>'}
  `;
}

// ====== SETTINGS ======
function renderSettings(){
  const s = A.settings;
  return `
    <div class="sect-hd">
      <div>
        <div class="sect-title">Settings</div>
        <div class="sect-sub">Store configuration</div>
      </div>
    </div>

    <div class="form-card">
      <div class="form-title">📱 Dual WhatsApp Ordering</div>
      <div style="font-size:11.5px;color:#888;margin-bottom:11px;line-height:1.5">Customers tap one of two buttons at checkout. Use full international format without "+" (e.g. <strong>8801712345678</strong> for BD, <strong>821012345678</strong> for Korea).</div>
      <div class="row2">
        <div>
          <label class="label">WhatsApp 1 — Number</label>
          <input class="input" id="s-wa1" value="${escA(s.whatsappNumber1||'')}" placeholder="821021979735"/>
        </div>
        <div>
          <label class="label">WhatsApp 1 — Label</label>
          <input class="input" id="s-wa1lbl" value="${escA(s.whatsappLabel1||'')}" placeholder="Akash"/>
        </div>
      </div>
      <div class="row2">
        <div>
          <label class="label">WhatsApp 2 — Number</label>
          <input class="input" id="s-wa2" value="${escA(s.whatsappNumber2||'')}" placeholder="821044610289"/>
        </div>
        <div>
          <label class="label">WhatsApp 2 — Label</label>
          <input class="input" id="s-wa2lbl" value="${escA(s.whatsappLabel2||'')}" placeholder="Imran"/>
        </div>
      </div>
    </div>

    <div class="form-card">
      <div class="form-title">💳 Payment Numbers</div>
      <div style="font-size:11.5px;color:#888;margin-bottom:11px">Shown to customer on payment screen. Leave blank to hide that option's instructions.</div>
      <label class="label">bKash Number (Personal/Agent)</label>
      <input class="input" id="s-bkash" value="${escA(s.bkashNumber||'')}" placeholder="01XXXXXXXXX"/>
      <div style="font-size:10.5px;color:#aaa;margin-bottom:11px;margin-top:-6px">💡 Tip: Use your personal bKash or agent number. Customer sends money + screenshot via WhatsApp.</div>
      <label class="label">Nagad Number</label>
      <input class="input" id="s-nagad" value="${escA(s.nagadNumber||'')}" placeholder="01XXXXXXXXX"/>
      <label class="label">Rocket Number (optional)</label>
      <input class="input" id="s-rocket" value="${escA(s.rocketNumber||'')}" placeholder="01XXXXXXXXX"/>
    </div>

    <div class="form-card">
      <div class="form-title">🏪 Store Info</div>
      <label class="label">Store Name</label>
      <input class="input" id="s-name" value="${escA(s.storeName||'')}"/>
      <label class="label">Tagline</label>
      <input class="input" id="s-tag" value="${escA(s.tagline||'')}"/>
      <label class="label">Address</label>
      <input class="input" id="s-addr" value="${escA(s.shopAddress||'')}"/>
      <label class="label">Announcement Bar</label>
      <input class="input" id="s-anno" value="${escA(s.announcement||'')}"/>
    </div>

    <div class="form-card">
      <div class="form-title">🎨 Hero Section</div>
      <label class="label">Hero Title</label>
      <textarea class="input textarea" id="s-htitle">${escA(s.heroTitle||'')}</textarea>
      <label class="label">Hero Subtitle</label>
      <textarea class="input textarea" id="s-hsub">${escA(s.heroSubtitle||'')}</textarea>
      <label class="label">Offer Badge</label>
      <input class="input" id="s-hoffer" value="${escA(s.heroOffer||'')}"/>
    </div>

    <div class="form-card">
      <div class="form-title">🚚 Shipping</div>
      <div class="row3">
        <div>
          <label class="label">Inside Dhaka (৳)</label>
          <input class="input" id="s-ship-in" type="number" value="${s.shippingInsideDhaka||80}"/>
        </div>
        <div>
          <label class="label">Outside Dhaka (৳)</label>
          <input class="input" id="s-ship-out" type="number" value="${s.shippingOutsideDhaka||130}"/>
        </div>
        <div>
          <label class="label">Free over (৳)</label>
          <input class="input" id="s-free" type="number" value="${s.freeShippingThreshold||2000}"/>
        </div>
      </div>
    </div>

    <div class="form-card">
      <div class="form-title">🎨 Theme Colors</div>
      <label class="label">Primary (Pink)</label>
      <input class="input" id="s-pri" value="${escA(s.primaryColor||'#ff6b9d')}"/>
      <label class="label">Accent (Purple)</label>
      <input class="input" id="s-acc" value="${escA(s.accentColor||'#c44dff')}"/>
    </div>

    <div class="form-card">
      <div class="form-title">📑 Categories</div>
      <label class="label">Categories (comma-separated)</label>
      <input class="input" id="s-cats" value="${escA((s.categories||[]).join(', '))}"/>
    </div>

    <button class="save-btn ok" onclick="saveSettings()">💾 Save All Settings</button>
  `;
}

async function saveSettings(){
  const s = { ...A.settings };
  s.whatsappNumber1 = $a('s-wa1').value.trim();
  s.whatsappLabel1  = $a('s-wa1lbl').value.trim();
  s.whatsappNumber2 = $a('s-wa2').value.trim();
  s.whatsappLabel2  = $a('s-wa2lbl').value.trim();
  s.bkashNumber  = $a('s-bkash').value.trim();
  s.nagadNumber  = $a('s-nagad').value.trim();
  s.rocketNumber = $a('s-rocket').value.trim();
  s.storeName    = $a('s-name').value.trim();
  s.tagline      = $a('s-tag').value.trim();
  s.shopAddress  = $a('s-addr').value.trim();
  s.announcement = $a('s-anno').value.trim();
  s.heroTitle    = $a('s-htitle').value;
  s.heroSubtitle = $a('s-hsub').value;
  s.heroOffer    = $a('s-hoffer').value.trim();
  s.shippingInsideDhaka  = parseInt($a('s-ship-in').value)  || 80;
  s.shippingOutsideDhaka = parseInt($a('s-ship-out').value) || 130;
  s.freeShippingThreshold= parseInt($a('s-free').value)     || 2000;
  s.primaryColor = $a('s-pri').value.trim() || '#ff6b9d';
  s.accentColor  = $a('s-acc').value.trim() || '#c44dff';
  s.categories   = $a('s-cats').value.split(',').map(x=>x.trim()).filter(Boolean);

  await Store.saveSettings(s);
  A.settings = s;
  toastA('✓ Settings saved');
  renderApp();
}

// ====== INIT ======
// ═══════════════════════════════════════════
// FIREBASE STORAGE — Product Image Upload
// ═══════════════════════════════════════════

// Toggle URL input visibility
function toggleImgUrl(){
  const row=$a('p-img-url-row');
  if(row){row.style.display=row.style.display==='none'?'block':'none'}
}

// Preview image as user types URL
function previewImgUrl(url){
  const preview=$a('p-img-preview');
  const hidden=$a('p-img-hidden');
  if(!preview)return;
  if(url&&(url.startsWith('http')||url.startsWith('data:'))){
    preview.innerHTML=`<img src="${escA(url)}" alt="preview" onerror="this.parentNode.innerHTML='<span class=img-placeholder>❌ Invalid URL</span>'"/>`;
    if(hidden)hidden.value=url;
  } else if(!url){
    preview.innerHTML='<span class="img-placeholder">📷</span>';
    if(hidden)hidden.value='';
  }
}

// Upload file to Firebase Storage
async function uploadProductImage(event){
  const file=event.target.files&&event.target.files[0];
  if(!file)return;

  // Validate
  if(!file.type.startsWith('image/')){toastA('Please select an image file',true);return}
  if(file.size>5*1024*1024){toastA('Image must be under 5MB',true);return}

  const preview=$a('p-img-preview');
  const progress=$a('p-img-progress');
  const hidden=$a('p-img-hidden');

  // Show preview immediately (using FileReader for instant feedback)
  const reader=new FileReader();
  reader.onload=function(e){
    if(preview)preview.innerHTML=`<img src="${e.target.result}" alt="preview" style="opacity:.5"/>`;
  };
  reader.readAsDataURL(file);

  // Check if Firebase Storage available
  if(!useFirebase||!storage){
    // Fallback: store as base64 data URL (works but heavier — only for tiny images)
    if(file.size>500*1024){
      toastA('Firebase Storage not enabled. Image must be under 500KB to embed.',true);
      if(preview)preview.innerHTML='<span class="img-placeholder">📷</span>';
      return;
    }
    reader.onload=function(e){
      const dataUrl=e.target.result;
      if(preview)preview.innerHTML=`<img src="${dataUrl}" alt="preview"/>`;
      if(hidden)hidden.value=dataUrl;
      toastA('Image embedded (Firebase Storage not enabled)');
    };
    reader.readAsDataURL(file);
    return;
  }

  // Upload to Firebase Storage
  try{
    if(progress)progress.style.display='block';
    if(progress)progress.textContent='Uploading... 0%';

    const timestamp=Date.now();
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,50);
    const path=`products/${timestamp}_${safeName}`;
    const ref=storage.ref(path);
    const task=ref.put(file);

    task.on('state_changed',
      (snapshot)=>{
        const pct=Math.round((snapshot.bytesTransferred/snapshot.totalBytes)*100);
        if(progress)progress.textContent='Uploading... '+pct+'%';
      },
      (error)=>{
        console.error('Upload failed:',error);
        toastA('Upload failed: '+error.message,true);
        if(progress)progress.style.display='none';
        if(preview)preview.innerHTML='<span class="img-placeholder">❌ Failed</span>';
      },
      async ()=>{
        // Upload complete — get URL
        try{
          const url=await ref.getDownloadURL();
          if(preview)preview.innerHTML=`<img src="${escA(url)}" alt="preview"/>`;
          if(hidden)hidden.value=url;
          if(progress)progress.textContent='✓ Uploaded';
          setTimeout(()=>{if(progress)progress.style.display='none'},2000);
          toastA('Image uploaded successfully');
        }catch(e){
          toastA('Failed to get image URL',true);
          if(progress)progress.style.display='none';
        }
      }
    );
  }catch(e){
    console.error('Storage error:',e);
    toastA('Upload failed: '+e.message,true);
    if(progress)progress.style.display='none';
  }
}

function start(){
  // Session restore with 4-hour expiry
  try {
    const raw = sessionStorage.getItem('bhan_admin');
    if (raw) {
      const session = JSON.parse(raw);
      if (session && session.ts && (Date.now() - session.ts < 4 * 60 * 60 * 1000)) {
        A.loggedIn = true;
      } else {
        sessionStorage.removeItem('bhan_admin');
      }
    }
  } catch(e){}
  if (A.loggedIn) boot(); else renderLogin();
}
document.addEventListener('DOMContentLoaded', start);
