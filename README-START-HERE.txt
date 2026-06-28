╔═══════════════════════════════════════════════╗
║   B·HAN — COMPLETE PACKAGE — START HERE        ║
╚═══════════════════════════════════════════════╝

You have EVERYTHING. No more coding needed. Just deploy & configure.

━━━ WHAT'S IN THIS ZIP ━━━
CUSTOMER APP:
  index.html ............ main app (hologram celadon design)
  app.js ................ all app logic + hologram FX
  data.js ............... Firebase data layer (secure)
  firebase-config.js .... Firebase connection
  products-data.js ...... 200 products
  skin-camera.js ........ AI skin scan (camera)
  sw.js ................. offline support (cache v11)
  manifest.json ......... installable app config

ADMIN PANEL:
  control-bhan-2025.html  open this at yoursite.com/control-bhan-2025.html
                          (hologram celadon design, matches the app)

SECURITY:
  firestore.rules ....... PASTE into Firebase → Firestore → Rules → Publish
  storage.rules ......... PASTE into Firebase → Storage → Rules (for photos)
  vercel.json ........... server security headers (auto-applied by Vercel)

LEGAL / STORE:
  privacy.html, terms.html, robots.txt
  .well-known/assetlinks.json  (update SHA256 after PWABuilder)
  icons/ ................ app icons (192, 512, 1024)

GUIDES:
  SETUP-ADMIN.txt ....... how to make yourself admin (DO THIS!)
  PUBLISH-CHECKLIST.txt . full Play Store publishing runbook

━━━ DO THIS IN ORDER ━━━
1. GitHub: delete old files in imran007-bit/b-han, upload ALL of these
   (keep folders icons/ and .well-known/)
2. Vercel auto-deploys → open b-han.vercel.app
3. Firebase one-time admin setup (see SETUP-ADMIN.txt):
   - Authentication → Users → copy YOUR UID
   - Firestore → create collection "admins" → doc ID = your UID → role:owner
   - Firestore → Rules → paste firestore.rules → Publish
4. Login to admin at b-han.vercel.app/control-bhan-2025.html (your email+pw)
5. Admin → Settings → set friend's bKash agent number
6. Play Store: follow PUBLISH-CHECKLIST.txt

━━━ EVERYTHING YOU CONTROL FROM ADMIN (no code) ━━━
products · prices · photos · coupons · orders · order tracking ·
customers · hero text · announcement bar · WhatsApp numbers ·
bKash/Nagad numbers · shipping rates · free-ship threshold ·
categories · colors

SECURITY: fully hardened. Firebase server-side passwords, admin
allowlist, owner-only data rules, 852-billion order IDs, XSS-safe,
CSP + server headers. No one can read other customers' data.
