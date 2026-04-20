// Infrastructure smoke test for real-time Firestore collaboration.
// Simulates two clients: client A uploads a project, client B listens
// for updates. If the rules + auth + sync wiring are correct, the
// update propagates within a few seconds.
//
// Reads Firebase config from the repo's .env file. Uses anonymous auth
// (enabled in the Console), which is exactly what useFirebaseSync falls
// back to when no logged-in user is present.

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';

function loadEnv() {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function makeClient(envVars, label) {
  const app = initializeApp({
    apiKey: envVars.VITE_FIREBASE_API_KEY,
    authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: envVars.VITE_FIREBASE_PROJECT_ID,
    storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.VITE_FIREBASE_APP_ID,
  }, label);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const env = loadEnv();
  console.log(`[smoke] project=${env.VITE_FIREBASE_PROJECT_ID}`);

  const A = makeClient(env, 'clientA');
  const B = makeClient(env, 'clientB');

  console.log('[smoke] signing in two anonymous clients...');
  const userA = await signInAnonymously(A.auth);
  const userB = await signInAnonymously(B.auth);
  console.log(`[smoke]   A uid=${userA.user.uid.slice(0, 8)}...`);
  console.log(`[smoke]   B uid=${userB.user.uid.slice(0, 8)}...`);

  const shareId = `smoketest-${Date.now().toString(36)}`;
  console.log(`[smoke] shareId=${shareId}`);

  // Client A writes a project.
  const projectRefA = doc(A.db, 'projects', shareId);
  const initialProject = {
    id: shareId,
    shareId,
    name: 'Smoke test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCloud: true,
    ownerId: userA.user.uid,
    collaborators: [],
    suppliers: [],
    buyers: [],
    meetings: [],
    timeSlots: [],
    unscheduledPairs: [],
    eventConfig: null,
  };

  console.log('[smoke] A -> write initial project');
  const writeStart = Date.now();
  await setDoc(projectRefA, initialProject);
  console.log(`[smoke]   write ok in ${Date.now() - writeStart}ms`);

  // Client B subscribes and should receive the doc immediately + on updates.
  const projectRefB = doc(B.db, 'projects', shareId);

  let firstSnap = null;
  let updateSnap = null;
  let updateSeenAt = 0;
  const updateStart = Date.now();

  const unsub = onSnapshot(projectRefB, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (!firstSnap) {
      firstSnap = data;
      console.log(`[smoke] B <- initial snapshot (${Date.now() - writeStart}ms after A's write)`);
    } else if (data.name !== firstSnap.name) {
      updateSnap = data;
      updateSeenAt = Date.now();
      console.log(`[smoke] B <- update seen (${updateSeenAt - updateStart}ms after A's update)`);
    }
  }, (err) => {
    console.error('[smoke] B listener error:', err.code || err.message);
  });

  // Wait for initial snapshot.
  for (let i = 0; i < 20 && !firstSnap; i++) await sleep(250);
  if (!firstSnap) {
    console.error('[smoke] FAIL: B never received initial snapshot within 5s');
    unsub();
    process.exit(1);
  }

  // Client A updates the project name — B should see it.
  console.log('[smoke] A -> update project name');
  const updateStartLocal = Date.now();
  await updateDoc(projectRefA, { name: 'Smoke test (updated)', updatedAt: new Date().toISOString() });
  console.log(`[smoke]   update write ok in ${Date.now() - updateStartLocal}ms`);

  for (let i = 0; i < 40 && !updateSnap; i++) await sleep(250);
  unsub();

  if (!updateSnap) {
    console.error('[smoke] FAIL: B never saw A\'s update within 10s');
    process.exit(1);
  }
  if (updateSnap.name !== 'Smoke test (updated)') {
    console.error(`[smoke] FAIL: B saw wrong value: ${updateSnap.name}`);
    process.exit(1);
  }

  // Cleanup — remove the test project so Firestore doesn't accumulate junk.
  try {
    await updateDoc(projectRefA, { __smoketest_cleanup__: true });
  } catch {}

  console.log('');
  console.log('[smoke] ---- RESULTS ----');
  console.log('[smoke] PASS: rules allow authenticated read/write');
  console.log('[smoke] PASS: two clients can collaborate in real time');
  console.log(`[smoke]       end-to-end propagation ~${updateSeenAt - updateStartLocal}ms`);
  console.log(`[smoke] leftover doc: projects/${shareId} (delete in Firebase Console if desired)`);
  process.exit(0);
}

main().catch(err => {
  console.error('[smoke] unexpected error:', err?.code || err?.message || err);
  process.exit(1);
});
