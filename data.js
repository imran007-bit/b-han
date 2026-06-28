// ============================================
// B HAN — Data Layer v4
// Firebase Auth (Email Verification) + Firestore
// ============================================

const Store = {
  _ls(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
  _lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  _now() { return Date.now(); },

  // ══════════════════════════════════════════
  // AUTH — Firebase Email/Password + Verification
  // ══════════════════════════════════════════

  _normPhone(p) {
    let n = (p || '').replace(/[^\d]/g, '');
    if (n.startsWith('880')) n = '0' + n.slice(3);
    if (n.length === 10 && n.startsWith('1')) n = '0' + n;
    return n;
  },
  _validatePhone(p) { return /^01[3-9]\d{8}$/.test(p); },
  _sanitize(s, max) { return String(s || '').replace(/<[^>]*>/g, '').replace(/[<>"']/g, '').trim().slice(0, max || 100); },

  // Rate limiting
  _loginAttempts: [],
  _checkRateLimit() {
    const now = Date.now();
    this._loginAttempts = this._loginAttempts.filter(t => now - t < 300000);
    if (this._loginAttempts.length >= 5) {
      const wait = Math.ceil((300000 - (now - this._loginAttempts[0])) / 1000);
      throw new Error('Too many attempts. Wait ' + wait + ' seconds.');
    }
    this._loginAttempts.push(now);
  },

  // Register with email + password → sends verification email
  async register(email, password, name, phone) {
    email = (email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid email required');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
    if (password.length > 64) throw new Error('Password too long');
    name = this._sanitize(name, 60);
    if (!name) throw new Error('Name is required');
    phone = this._normPhone(phone);
    if (!this._validatePhone(phone)) throw new Error('Valid BD phone required (01XXXXXXXXX)');

    if (useFirebase && auth) {
      try {
        // Create Firebase Auth user
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;

        // Send verification email
        await user.sendEmailVerification();

        // Save profile to Firestore
        const profile = {
          uid: user.uid, email, name, phone,
          address: '', area: 'inside',
          createdAt: this._now(), lastLogin: this._now(),
          emailVerified: false
        };
        if (db) {
          await db.collection('customers').doc(user.uid).set(profile);
        }
        this._lsSet('bhan_user_profile', profile);
        return { ...profile, firebaseUser: user };

      } catch (e) {
        if (e.code === 'auth/email-already-in-use') throw new Error('This email is already registered. Please login.');
        if (e.code === 'auth/weak-password') throw new Error('Password is too weak. Use at least 6 characters.');
        if (e.code === 'auth/invalid-email') throw new Error('Invalid email address.');
        throw new Error(e.message || 'Registration failed');
      }
    } else {
      // localStorage fallback (no email verification possible)
      const existing = this._ls('bhan_customers', []);
      if (existing.find(c => c.email === email)) throw new Error('This email is already registered.');
      const profile = {
        uid: 'local_' + Date.now(), email, name, phone,
        address: '', area: 'inside',
        createdAt: this._now(), lastLogin: this._now(),
        emailVerified: true // auto-verify in offline mode
      };
      existing.unshift(profile);
      this._lsSet('bhan_customers', existing);
      this._lsSet('bhan_user_profile', profile);
      return profile;
    }
  },

  // Login with email + password
  async login(email, password) {
    email = (email || '').trim().toLowerCase();
    if (!email || !password) throw new Error('Email and password required');
    this._checkRateLimit();

    if (useFirebase && auth) {
      try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const user = cred.user;

        // Fetch profile from Firestore
        let profile = null;
        if (db) {
          const doc = await db.collection('customers').doc(user.uid).get();
          if (doc.exists) profile = { uid: user.uid, ...doc.data() };
        }
        if (!profile) {
          profile = { uid: user.uid, email: user.email, name: '', phone: '', address: '', area: 'inside' };
        }
        profile.emailVerified = user.emailVerified;
        profile.lastLogin = this._now();
        this._lsSet('bhan_user_profile', profile);

        // Update last login in Firestore
        if (db) {
          try { await db.collection('customers').doc(user.uid).update({ lastLogin: this._now(), emailVerified: user.emailVerified }); } catch (e) {}
        }
        return { ...profile, firebaseUser: user };

      } catch (e) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
          throw new Error('Invalid email or password.');
        }
        if (e.code === 'auth/too-many-requests') throw new Error('Too many attempts. Please try again later.');
        throw new Error(e.message || 'Login failed');
      }
    } else {
      // localStorage fallback
      const list = this._ls('bhan_customers', []);
      const found = list.find(c => c.email === email);
      if (!found) throw new Error('Invalid email or password.');
      // In offline mode, no real password check — just match email
      found.lastLogin = this._now();
      this._lsSet('bhan_customers', list);
      this._lsSet('bhan_user_profile', found);
      return found;
    }
  },

  // Resend verification email
  async resendVerification() {
    if (useFirebase && auth && auth.currentUser) {
      try {
        await auth.currentUser.sendEmailVerification();
        return true;
      } catch (e) {
        if (e.code === 'auth/too-many-requests') throw new Error('Too many emails sent. Wait a few minutes.');
        throw new Error('Failed to send verification email.');
      }
    }
    throw new Error('Not logged in via Firebase.');
  },

  // Check if email is verified (refresh from Firebase)
  async checkVerification() {
    if (useFirebase && auth && auth.currentUser) {
      await auth.currentUser.reload();
      const verified = auth.currentUser.emailVerified;
      const profile = this._ls('bhan_user_profile', null);
      if (profile) {
        profile.emailVerified = verified;
        this._lsSet('bhan_user_profile', profile);
      }
      // Update Firestore
      if (db && verified) {
        try { await db.collection('customers').doc(auth.currentUser.uid).update({ emailVerified: true }); } catch (e) {}
      }
      return verified;
    }
    return true; // offline = auto-verified
  },

  // Get current user (with session expiry for offline mode)
  getCurrentUser() {
    const profile = this._ls('bhan_user_profile', null);
    if (!profile) return null;
    // Session expiry: 7 days for localStorage sessions
    if (profile.sessionCreatedAt && (Date.now() - profile.sessionCreatedAt > 7 * 24 * 60 * 60 * 1000)) {
      this.logout();
      return null;
    }
    // Check if Firebase user is still signed in
    if (useFirebase && auth) {
      const fbUser = auth.currentUser;
      if (fbUser) {
        profile.emailVerified = fbUser.emailVerified;
      }
    }
    // Strip sensitive fields
    const { pwHash, ...safe } = profile;
    return safe;
  },

  // Logout
  async logout() {
    if (useFirebase && auth) {
      try { await auth.signOut(); } catch (e) {}
    }
    try { localStorage.removeItem('bhan_user_profile'); } catch (e) {}
  },

  // Update profile
  async updateProfile(updates) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Not logged in');
    const clean = {};
    if (updates.name) clean.name = this._sanitize(updates.name, 60);
    if (updates.phone) { const p = this._normPhone(updates.phone); if (this._validatePhone(p)) clean.phone = p; }
    if (updates.address) clean.address = this._sanitize(updates.address, 200);
    if (updates.area && (updates.area === 'inside' || updates.area === 'outside')) clean.area = updates.area;
    clean.updatedAt = this._now();

    if (useFirebase && db && user.uid) {
      try { await db.collection('customers').doc(user.uid).update(clean); } catch (e) { console.warn('profile update failed', e); }
    }
    const merged = { ...user, ...clean };
    this._lsSet('bhan_user_profile', merged);
    return merged;
  },

  // Send password reset email
  async resetPassword(email) {
    if (useFirebase && auth) {
      try {
        await auth.sendPasswordResetEmail(email.trim().toLowerCase());
        return true;
      } catch (e) {
        if (e.code === 'auth/user-not-found') throw new Error('No account with this email.');
        throw new Error('Failed to send reset email.');
      }
    }
    throw new Error('Password reset requires Firebase.');
  },

  // ══════════════════════════════════════════
  // SKIN PROFILE
  // ══════════════════════════════════════════
  getSkinProfile() {
    const user = this.getCurrentUser();
    const key = user ? 'bhan_skin_' + user.uid : 'bhan_skin_guest';
    return this._ls(key, null);
  },
  saveSkinProfile(profile) {
    const user = this.getCurrentUser();
    const key = user ? 'bhan_skin_' + user.uid : 'bhan_skin_guest';
    profile.savedAt = this._now();
    this._lsSet(key, profile);
    return profile;
  },
  clearSkinProfile() {
    const user = this.getCurrentUser();
    const key = user ? 'bhan_skin_' + user.uid : 'bhan_skin_guest';
    try { localStorage.removeItem(key); } catch (e) {}
  },

  // ══════════════════════════════════════════
  // SETTINGS, PRODUCTS, ORDERS, COUPONS — same as v3
  // ══════════════════════════════════════════
  async getSettings() {
    const cached = this._ls('bhan_settings', null);
    if (useFirebase && db) {
      try { const doc = await db.collection('settings').doc('store').get(); if (doc.exists) { const data = { ...STORE_DEFAULTS, ...doc.data() }; this._lsSet('bhan_settings', data); return data; } } catch (e) {}
    }
    return cached || { ...STORE_DEFAULTS };
  },
  async saveSettings(s) { this._lsSet('bhan_settings', s); if (useFirebase && db) { try { await db.collection('settings').doc('store').set(s, { merge: true }); } catch (e) {} } return s; },

  async getProducts() {
    if (useFirebase && db) {
      try {
        const snap = await db.collection('products').orderBy('createdAt', 'desc').get();
        if (snap.docs.length > 0) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this._lsSet('bhan_products', list); return list;
        }
      } catch (e) {}
    }
    // Check localStorage
    const cached = this._ls('bhan_products', []);
    if (cached.length > 0) return cached;
    // Seed from PRODUCT_CATALOG if available (200 Olive Young products)
    if (typeof PRODUCT_CATALOG !== 'undefined' && PRODUCT_CATALOG.length > 0) {
      const seeded = PRODUCT_CATALOG.map((p, i) => ({ ...p, createdAt: this._now() - (i * 60000) }));
      this._lsSet('bhan_products', seeded);
      // Also push to Firestore if available
      if (useFirebase && db) {
        try {
          const batch = db.batch();
          seeded.slice(0, 50).forEach(p => { batch.set(db.collection('products').doc(p.id), p); });
          await batch.commit();
          console.log('✅ Seeded first 50 products to Firestore');
        } catch (e) { console.warn('Firestore seed failed (will use localStorage)', e); }
      }
      return seeded;
    }
    return [];
  },
  async saveProduct(p) {
    if (!p.id) p.id = 'p' + Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(10)).join('').slice(0, 6);
    if (!p.createdAt) p.createdAt = this._now(); p.updatedAt = this._now();
    if (useFirebase && db) { try { await db.collection('products').doc(p.id).set(p, { merge: true }); } catch (e) {} }
    const list = this._ls('bhan_products', []); const idx = list.findIndex(x => x.id === p.id);
    if (idx >= 0) list[idx] = p; else list.unshift(p); this._lsSet('bhan_products', list); return p;
  },
  async deleteProduct(id) { if (useFirebase && db) { try { await db.collection('products').doc(id).delete(); } catch (e) {} } this._lsSet('bhan_products', this._ls('bhan_products', []).filter(p => p.id !== id)); },

  async createOrder(order) {
    order.id = order.id || ('BHN' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join(''));
    order.createdAt = order.createdAt || this._now(); order.updatedAt = this._now();
    order.status = order.status || 'pending'; order.trackingStatus = order.trackingStatus || 'received';
    order.trackingNote = order.trackingNote || ''; order.lastUpdate = this._now();
    order.statusHistory = order.statusHistory || [{ status: 'received', note: 'Order placed via WhatsApp', ts: this._now() }];
    const user = this.getCurrentUser();
    if (user) { order.customerId = user.uid; order.customerEmail = user.email; order.customerPhone = user.phone; }
    if (useFirebase && db) { try { await db.collection('orders').doc(order.id).set(order); } catch (e) {} }
    const list = this._ls('bhan_orders', []); list.unshift(order); this._lsSet('bhan_orders', list); return order;
  },
  async getOrders() {
    if (useFirebase && db) { try { const snap = await db.collection('orders').orderBy('createdAt', 'desc').get(); const list = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._lsSet('bhan_orders', list); return list; } catch (e) {} }
    return this._ls('bhan_orders', []);
  },
  async getMyOrders() {
    const user = this.getCurrentUser(); if (!user) return [];
    // Secure rules only allow customers to LIST their own orders — query by customerId
    if (useFirebase && db && user.uid && !String(user.uid).startsWith('local_')) {
      try {
        const snap = await db.collection('orders').where('customerId', '==', user.uid).get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        this._lsSet('bhan_my_orders', list);
        return list;
      } catch (e) {
        const cached = this._ls('bhan_my_orders', null);
        if (cached) return cached;
      }
    }
    // Offline fallback: filter local orders
    const all = this._ls('bhan_orders', []);
    return all.filter(o => o.customerId === user.uid || o.customerEmail === user.email || (o.customer && o.customer.phone && this._normPhone(o.customer.phone) === user.phone));
  },
  async lookupOrder(orderId) {
    orderId = String(orderId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    if (orderId.length < 6) return null;
    if (!orderId) return null; const cleanId = orderId.trim().toUpperCase();
    if (useFirebase && db) { try { const doc = await db.collection('orders').doc(cleanId).get(); if (doc.exists) return { id: doc.id, ...doc.data() }; } catch (e) {} }
    return this._ls('bhan_orders', []).find(o => (o.id || '').toUpperCase() === cleanId) || null;
  },
  async updateOrderStatus(orderId, status) {
    const u = { status, updatedAt: this._now() };
    if (useFirebase && db) { try { await db.collection('orders').doc(orderId).update(u); } catch (e) {} }
    const list = this._ls('bhan_orders', []); const idx = list.findIndex(o => o.id === orderId);
    if (idx >= 0) { list[idx] = { ...list[idx], ...u }; this._lsSet('bhan_orders', list); }
  },
  async updateTracking(orderId, trackingStatus, trackingNote) {
    const ts = this._now(); const list = this._ls('bhan_orders', []); const idx = list.findIndex(o => o.id === orderId);
    let history = []; if (idx >= 0) history = list[idx].statusHistory || [];
    history = history.concat([{ status: trackingStatus, note: trackingNote || '', ts }]);
    const u = { trackingStatus, trackingNote: trackingNote || '', lastUpdate: ts, updatedAt: ts, statusHistory: history };
    if (useFirebase && db) { try { await db.collection('orders').doc(orderId).update(u); } catch (e) {} }
    if (idx >= 0) { list[idx] = { ...list[idx], ...u }; this._lsSet('bhan_orders', list); } return u;
  },

  async getCoupons() { if (useFirebase && db) { try { const snap = await db.collection('coupons').get(); const list = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._lsSet('bhan_coupons', list); return list; } catch (e) {} } return this._ls('bhan_coupons', []); },
  async saveCoupon(c) { if (!c.id) c.id = c.code || ('c' + Date.now()); if (useFirebase && db) { try { await db.collection('coupons').doc(c.id).set(c, { merge: true }); } catch (e) {} } const list = this._ls('bhan_coupons', []); const idx = list.findIndex(x => x.id === c.id); if (idx >= 0) list[idx] = c; else list.unshift(c); this._lsSet('bhan_coupons', list); return c; },
  async deleteCoupon(id) { if (useFirebase && db) { try { await db.collection('coupons').doc(id).delete(); } catch (e) {} } this._lsSet('bhan_coupons', this._ls('bhan_coupons', []).filter(c => c.id !== id)); },

  // Admin: get all registered customers
  async getCustomers() {
    let customers = [];
    if (useFirebase && db) {
      try { const snap = await db.collection('customers').orderBy('createdAt', 'desc').get(); customers = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._lsSet('bhan_customers', customers); } catch (e) { customers = this._ls('bhan_customers', []); }
    } else { customers = this._ls('bhan_customers', []); }
    const orders = await this.getOrders();
    return customers.map(c => {
      const my = orders.filter(o => o.customerId === c.uid || o.customerEmail === c.email || (o.customer && o.customer.phone && Store._normPhone(o.customer.phone) === c.phone));
      return { ...c, orderCount: my.length, totalSpent: my.reduce((s, o) => s + (o.total || 0), 0), lastOrder: my.length ? Math.max(...my.map(o => o.createdAt || 0)) : 0, orders: my };
    });
  },

  recommendForProfile(profile, products) {
    if (!profile || !products || !products.length) return [];
    const concerns = (profile.concerns || []).map(c => c.toLowerCase()), skinType = (profile.skinType || '').toLowerCase();
    return products.map(p => {
      const tags = ((p.tags || []).concat(p.category || '', p.skinType || '', p.concern || '')).filter(Boolean).map(t => String(t).toLowerCase());
      let score = 0; if (skinType && tags.some(t => t.includes(skinType))) score += 3;
      concerns.forEach(c => { if (tags.some(t => t.includes(c))) score += 2; }); if (p.featured) score += 1;
      return { p, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8).map(x => x.p);
  }
};
