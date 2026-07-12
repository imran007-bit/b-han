// ============================================
// B HAN — Firebase Configuration v4
// Firebase Auth (Email/Password) + Firestore
// ============================================

window.firebaseConfig = {
  apiKey: "AIzaSyAoq6DJOtwHKdIpR2pRN8EJ43Wa7lFkj7Q",
  authDomain: "bhan-app.firebaseapp.com",
  projectId: "bhan-app",
  storageBucket: "bhan-app.firebasestorage.app",
  messagingSenderId: "921698494387",
  appId: "1:921698494387:web:3915da105e255ea96b8dc6",
  measurementId: "G-HKPVQ4L7X1"
};

// Admin password verification via SHA-256
async function verifyAdminPassword(pw) {
  const data = new TextEncoder().encode('bhan_admin_salt_2025:' + pw);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Migration: move old localStorage hash to a more obscure key in localStorage
  // (sessionStorage would lose it on browser close — bad UX for admin)
  // Use a non-obvious key name to reduce casual inspection risk
  const STORAGE_KEY = '_b_h_ctrl_v2';
  const OLD_KEY = 'bhan_admin_pw_hash';

  // Migrate old key if present
  const oldHash = localStorage.getItem(OLD_KEY);
  if (oldHash) {
    localStorage.setItem(STORAGE_KEY, oldHash);
    localStorage.removeItem(OLD_KEY);
  }

  const storedHash = localStorage.getItem(STORAGE_KEY);
  if (!storedHash) {
    // First-time bootstrap: compare against default admin password hash
    const defaultData = new TextEncoder().encode('bhan_admin_salt_2025:bhan2025admin');
    const defaultBuf = await crypto.subtle.digest('SHA-256', defaultData);
    const defaultHex = Array.from(new Uint8Array(defaultBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hashHex === defaultHex) {
      localStorage.setItem(STORAGE_KEY, hashHex);
      return true;
    }
    return false;
  }
  return hashHex === storedHash;
}

window.STORE_DEFAULTS = {
  storeName: "b·han", tagline: "Seoul → Dhaka",
  whatsappNumber1: "821021979735", whatsappLabel1: "Akash",
  whatsappNumber2: "821044610289", whatsappLabel2: "Imran",
  bkashNumber: "", nagadNumber: "", rocketNumber: "",
  shopAddress: "Dhaka, Bangladesh",
  freeShippingThreshold: 2000, shippingInsideDhaka: 80, shippingOutsideDhaka: 130,
  announcement: "✶ Authentic from Olive Young · Free delivery over ৳2,000",
  heroTitle: "The quiet\nglow ritual.",
  heroSubtitle: "Sourced weekly from Seoul.\nSix bottles, one ritual, three weeks to glass skin.",
  heroOffer: "Spring · 春",
  primaryColor: "#c2724a", accentColor: "#2a221a",
  categories: ["Skincare", "Toner", "Serum", "Moisturizer", "Cleanser", "Sunscreen", "Essence", "Eye Cream", "Sheet Mask", 'Haircare']
};

window.TRACKING_STATUSES = [
  { key: "received",     label: "Order Received",        icon: "📝" },
  { key: "paid",         label: "Payment Confirmed",     icon: "💳" },
  { key: "sourcing",     label: "Sourcing in Korea",     icon: "🔎" },
  { key: "packed",       label: "Packed in Korea",       icon: "📦" },
  { key: "shipped_kr",   label: "Shipped from Korea",    icon: "🛫" },
  { key: "in_transit",   label: "In Transit",            icon: "✈️" },
  { key: "arrived_bd",   label: "Arrived in Bangladesh", icon: "🇧🇩" },
  { key: "out_delivery", label: "Out for Delivery",      icon: "🚚" },
  { key: "delivered",    label: "Delivered",             icon: "✅" }
];

window.db = null; window.auth = null; window.storage = null;
window.useFirebase = false;

try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    // Prevent duplicate initialization
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    // Storage (optional — admin panel only)
    if (firebase.storage) {
      try { window.storage = firebase.storage(); } catch (e) { window.storage = null; }
    }
    useFirebase = true;
    console.log("✅ Firebase connected (Firestore + Auth" + (storage ? " + Storage" : "") + ")");
  } else {
    console.warn("⚠️ Firebase SDK not loaded — localStorage-only mode");
  }
} catch (e) {
  console.warn("⚠️ Firebase init failed:", e.message);
  useFirebase = false;
}
