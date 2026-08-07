// Reads a live project from Firestore and reports any double-booked
// meetings — two active meetings pointing at the same (supplier, slot)
// or (buyer, slot) pair. This is the "physically stacked in UI" bug
// that surfaced during past events.
//
// Usage: node scripts/audit-schedule-integrity.mjs <shareId>
//
// No writes, no data leaves the local machine. Uses anonymous auth,
// which is enabled in the Firebase Console and permitted by
// firestore.rules ("auth != null").

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

function loadEnv() {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function fmtSlot(slot) {
  if (!slot) return '(unknown slot)';
  const start = slot.startTime;
  const t = typeof start === 'string'
    ? new Date(start)
    : start?.toDate?.() ?? new Date();
  const hh = String(t.getUTCHours()).padStart(2, '0');
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  return `${slot.date} ${hh}:${mm}`;
}

async function main() {
  const shareId = process.argv[2];
  if (!shareId) {
    console.error('Usage: node scripts/audit-schedule-integrity.mjs <shareId>');
    process.exit(1);
  }

  const env = loadEnv();
  console.log(`[audit] project=${env.VITE_FIREBASE_PROJECT_ID} shareId=${shareId}`);

  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInAnonymously(auth);
  console.log(`[audit] signed in as anon uid=${auth.currentUser.uid.slice(0, 8)}...`);

  const snap = await getDoc(doc(db, 'projects', shareId));
  if (!snap.exists()) {
    console.error(`[audit] no project found for shareId "${shareId}"`);
    process.exit(1);
  }

  const project = snap.data();
  const meetings = project.meetings || [];
  const suppliers = project.suppliers || [];
  const buyers = project.buyers || [];
  const timeSlots = project.timeSlots || [];

  const suppliersById = new Map(suppliers.map(s => [s.id, s]));
  const buyersById = new Map(buyers.map(b => [b.id, b]));
  const slotsById = new Map(timeSlots.map(s => [s.id, s]));

  console.log(`[audit] project "${project.name || '(unnamed)'}"`);
  console.log(`[audit]   ${suppliers.length} suppliers, ${buyers.length} buyers`);
  console.log(`[audit]   ${timeSlots.length} time slots, ${meetings.length} meetings total`);

  const active = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped');
  console.log(`[audit]   ${active.length} active meetings (excluding cancelled/bumped)`);

  const supplierBuckets = new Map();
  const buyerBuckets = new Map();
  for (const m of active) {
    const sKey = `${m.supplierId}|${m.timeSlotId}`;
    const bKey = `${m.buyerId}|${m.timeSlotId}`;
    if (!supplierBuckets.has(sKey)) supplierBuckets.set(sKey, []);
    supplierBuckets.get(sKey).push(m);
    if (!buyerBuckets.has(bKey)) buyerBuckets.set(bKey, []);
    buyerBuckets.get(bKey).push(m);
  }

  const stackedSupplier = [...supplierBuckets.entries()].filter(([, ms]) => ms.length > 1);
  const stackedBuyer = [...buyerBuckets.entries()].filter(([, ms]) => ms.length > 1);

  console.log('\n[audit] ---- RESULTS ----');

  if (stackedSupplier.length === 0 && stackedBuyer.length === 0) {
    console.log('[audit] CLEAN — no double-bookings detected. Schedule integrity is intact.');
    process.exit(0);
  }

  console.log(`[audit] FOUND ${stackedSupplier.length} supplier double-booking(s), ${stackedBuyer.length} buyer double-booking(s)`);

  for (const [key, ms] of stackedSupplier) {
    const [supplierId, slotId] = key.split('|');
    const supplier = suppliersById.get(supplierId);
    console.log(`\n[audit]   Supplier stacked: ${supplier?.companyName || `(unknown id ${supplierId})`}`);
    console.log(`[audit]     slot: ${fmtSlot(slotsById.get(slotId))}`);
    for (const m of ms) {
      const b = buyersById.get(m.buyerId);
      console.log(`[audit]     - meeting ${m.id.slice(0, 8)} status=${m.status} buyer=${b?.name || `(id ${m.buyerId})`}`);
    }
  }

  for (const [key, ms] of stackedBuyer) {
    const [buyerId, slotId] = key.split('|');
    const buyer = buyersById.get(buyerId);
    console.log(`\n[audit]   Buyer stacked: ${buyer?.name || `(unknown id ${buyerId})`}`);
    console.log(`[audit]     slot: ${fmtSlot(slotsById.get(slotId))}`);
    for (const m of ms) {
      const s = suppliersById.get(m.supplierId);
      console.log(`[audit]     - meeting ${m.id.slice(0, 8)} status=${m.status} supplier=${s?.companyName || `(id ${m.supplierId})`}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[audit] fatal:', err);
  process.exit(1);
});
