// Reads a live project from Firestore and reports any double-booked
// meetings — two active meetings pointing at the same (supplier, slot)
// or (buyer, slot) pair. This is the "physically stacked in UI" bug
// that surfaced during past events.
//
// Usage:
//   node scripts/audit-schedule-integrity.mjs <shareId>          # audit only, no writes
//   node scripts/audit-schedule-integrity.mjs <shareId> --fix    # cancel the least-preferred duplicate in each stack
//
// Fix policy: for each stack we score every meeting by how well it
// matches the supplier's preference and keep the highest-scoring one;
// ties are broken by lexicographically-smallest meeting ID for
// determinism. Scoring:
//   3 = supplier.preference='include' AND buyer is in the include list
//       (this meeting was explicitly wanted)
//   2 = supplier.preference='all', OR
//       supplier.preference='exclude' AND buyer is NOT in the exclude list
//       (accepted by default)
//   1 = supplier.preference='include' AND buyer NOT in the include list
//       (buyer wasn't explicitly wanted, likely an accidental duplicate)
//   0 = supplier.preference='exclude' AND buyer IS in the exclude list
//       (violates the supplier's stated preference — almost certainly
//       an accidental duplicate)
// Cancelled meetings retain status='cancelled' in the array so nothing
// is lost — you can review and restore any wrong picks.
//
// Uses anonymous auth, which is enabled in the Firebase Console and
// permitted by firestore.rules ("auth != null"). No data leaves your
// machine.

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

// Score a meeting by how well it matches the supplier's stated
// preferences. Higher score = more likely to be legitimate.
// See file header for scoring rules.
function preferenceScore(meeting, supplier) {
  if (!supplier) return 2; // no supplier info -> default "accepted" tier
  const list = supplier.preferenceList || [];
  const inList = list.includes(meeting.buyerId);
  const pref = supplier.preference;
  if (pref === 'include') return inList ? 3 : 1;
  if (pref === 'exclude') return inList ? 0 : 2;
  return 2; // 'all' or unknown
}

// Given a stack of meetings, pick which to KEEP and return the rest.
// Highest preference score wins; ties broken by lex-smallest id so the
// choice is stable across runs.
function pickCancellations(stack, suppliersById) {
  const scored = stack.map(m => ({
    m,
    score: preferenceScore(m, suppliersById.get(m.supplierId)),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.m.id.localeCompare(b.m.id);
  });
  return { keep: scored[0], cancel: scored.slice(1) };
}

async function main() {
  const shareId = process.argv[2];
  const shouldFix = process.argv.includes('--fix');
  const skipConfirm = process.argv.includes('--yes');
  if (!shareId) {
    console.error('Usage:');
    console.error('  node scripts/audit-schedule-integrity.mjs <shareId>          # audit only');
    console.error('  node scripts/audit-schedule-integrity.mjs <shareId> --fix    # apply cancellations');
    console.error('  add --yes to skip the interactive confirmation');
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
  /** @type {Array<any>} */
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

  // Compute the set of meeting IDs to cancel. For each stack, prefer to
  // KEEP the meeting whose (supplier, buyer) pair best matches the
  // supplier's preferences (see preferenceScore). Ties broken by
  // lex-smallest id for determinism. A meeting may appear in both a
  // supplier stack and a buyer stack, so we dedupe via a set.
  const toCancel = new Set();
  const cancelReason = new Map(); // id -> "kept X because ..."
  for (const [, ms] of stackedSupplier) {
    const { keep, cancel } = pickCancellations(ms, suppliersById);
    for (const c of cancel) {
      toCancel.add(c.m.id);
      cancelReason.set(
        c.m.id,
        `kept ${keep.m.id.slice(0, 8)} (score ${keep.score}) over this one (score ${c.score})`,
      );
    }
  }
  for (const [, ms] of stackedBuyer) {
    const { keep, cancel } = pickCancellations(ms, suppliersById);
    for (const c of cancel) {
      toCancel.add(c.m.id);
      if (!cancelReason.has(c.m.id)) {
        cancelReason.set(
          c.m.id,
          `kept ${keep.m.id.slice(0, 8)} (score ${keep.score}) over this one (score ${c.score})`,
        );
      }
    }
  }
  console.log(`\n[audit] Would cancel ${toCancel.size} meeting(s) to resolve all stacks.`);
  for (const id of toCancel) {
    const m = meetings.find(x => x.id === id);
    const supplier = suppliersById.get(m?.supplierId);
    const buyer = buyersById.get(m?.buyerId);
    const slot = slotsById.get(m?.timeSlotId);
    const reason = cancelReason.get(id) || '';
    console.log(`[audit]     - meeting ${id.slice(0, 8)}: ${supplier?.companyName || m?.supplierId} × ${buyer?.name || m?.buyerId} @ ${fmtSlot(slot)}`);
    if (reason) console.log(`[audit]       ${reason}`);
  }

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

  if (!shouldFix) {
    console.log('\n[audit] Read-only run. Re-run with --fix to cancel the duplicates listed above.');
    process.exit(0);
  }

  if (!skipConfirm) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(`\n[audit] Apply cancellations to project "${project.name || shareId}"? (type "yes" to confirm) `);
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('[audit] aborted, no changes written.');
      process.exit(0);
    }
  }

  const updatedMeetings = meetings.map(m =>
    toCancel.has(m.id) ? { ...m, status: 'cancelled' } : m,
  );
  console.log('[audit] writing cancellations to Firestore...');
  await updateDoc(doc(db, 'projects', shareId), {
    meetings: updatedMeetings,
    updatedAt: serverTimestamp(),
  });
  console.log(`[audit] wrote ${toCancel.size} cancellation(s). Re-run without --fix to verify clean state.`);

  process.exit(0);
}

main().catch(err => {
  console.error('[audit] fatal:', err);
  process.exit(1);
});
