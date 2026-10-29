// নতুন ওষুধ তৈরি: data.js → Firestore (targeted, idempotent)
// - শুধু Firestore-এ নাম নেই এমন ওষুধ যোগ করে; বিদ্যমান কোনো ডকুমেন্ট বদলায় না।
// - ID = বর্তমান সর্বোচ্চ numeric ID ও counter-এর বড়টির পর থেকে।
// - সফল হলে baseline-এ নতুন ওষুধের ফিল্ড যোগ করে (ভবিষ্যৎ drift-সুরক্ষার জন্য)।
// - ডিফল্ট dry-run। আসলে লিখতে: node firebase-sync-new-remedies.mjs --apply
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { remedies as localRemedies } from './db/data.js';

const APPLY = process.argv.includes('--apply');
const FIELDS = ['clinical', 'keynotes', 'better', 'worse'];

if (!existsSync('./firebase-key.json')) {
  console.error('firebase-key.json পাওয়া যায়নি — Service Account কী এই ফোল্ডারে রাখুন।');
  process.exit(1);
}
if (!existsSync('./db/remedy-baseline.json')) {
  console.error('db/remedy-baseline.json পাওয়া যায়নি — থামানো হলো।');
  process.exit(1);
}

const key = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const baseline = JSON.parse(readFileSync('./db/remedy-baseline.json', 'utf8'));

const normName = (name) => String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const cut = (text, n = 60) => {
  const s = String(text ?? '').replace(/\s+/g, ' ');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

// ---------- ১. বর্তমান অবস্থা ----------
const fsDocs = (await db.collection('remedies').get()).docs;
const fsByName = new Map();
let maxId = 0;
for (const doc of fsDocs) {
  const data = doc.data();
  const name = normName(data.name);
  if (name && !fsByName.has(name)) fsByName.set(name, doc);
  const id = Number(data.id ?? doc.id);
  if (Number.isFinite(id)) maxId = Math.max(maxId, id);
}

const counterRef = db.collection('counters').doc('main');
const counterSnap = await counterRef.get();
const counter = counterSnap.exists ? Number(counterSnap.data().remedies) || 0 : 0;

const missing = localRemedies.filter((r) => !fsByName.has(normName(r.name)));

// ---------- ২. প্ল্যান ----------
let nextId = Math.max(maxId, counter) + 1;
const planned = missing.map((r) => {
  const doc = {
    id: nextId,
    name: r.name,
    source: r.source,
    clinical: r.clinical,
    better: r.better,
    worse: r.worse,
    is_custom: 0,
    keynotes: r.keynotes,
  };
  nextId++;
  return doc;
});

console.log(APPLY ? '=== APPLY মোড: Firestore-এ লেখা হবে ===' : '=== DRY-RUN: কিছুই লেখা হবে না ===');
console.log(`data.js: ${localRemedies.length} | Firestore: ${fsDocs.length} | সর্বোচ্চ ID: ${maxId} | counter.remedies: ${counter}`);
console.log(`যোগ করতে হবে: ${planned.length} ওষুধ`);
for (const r of planned) {
  console.log(`  + ${r.id}  ${r.name} — ${cut(r.keynotes, 50)}`);
}

// নিরাপত্তা: নামের ডুপ্লিকেট বা ID সংঘর্ষ হলে থামো
for (const r of planned) {
  const existing = await db.collection('remedies').doc(String(r.id)).get();
  if (existing.exists) {
    console.error(`থামানো হলো — remedies/${r.id} আগে থেকেই আছে (${existing.data().name ?? '?'})।`);
    process.exit(1);
  }
}
if (!planned.length) {
  console.log('সিঙ্ক করার মতো নতুন ওষুধ নেই।');
  process.exit(0);
}
if (!APPLY) {
  console.log('লিখতে চাইলে চালান: node firebase-sync-new-remedies.mjs --apply');
  process.exit(0);
}

// ---------- ৩. লেখা ----------
const bulk = db.bulkWriter();
for (const r of planned) {
  bulk.create(db.collection('remedies').doc(String(r.id)), r);
}
await bulk.close();

const newMax = Math.max(...planned.map((r) => r.id));
await db.runTransaction(async (tx) => {
  const snap = await tx.get(counterRef);
  const latest = snap.exists ? Number(snap.data().remedies) || 0 : 0;
  if (latest < newMax) tx.set(counterRef, { remedies: newMax }, { merge: true });
});

// ---------- ৪. baseline হালনাগাদ ----------
for (const r of planned) {
  const entry = {};
  for (const f of FIELDS) entry[f] = String(r[f] ?? '');
  baseline[r.name] = entry;
}
writeFileSync('./db/remedy-baseline.json', JSON.stringify(baseline, null, 2) + '\n', 'utf8');

// ---------- ৫. যাচাই ----------
let verified = 0;
for (const r of planned) {
  const snap = await db.collection('remedies').doc(String(r.id)).get();
  const d = snap.data() ?? {};
  if (
    snap.exists &&
    d.name === r.name &&
    String(d.keynotes) === String(r.keynotes) &&
    Number(d.id) === r.id
  ) verified++;
  else console.warn(`যাচাই ব্যর্থ: ${r.name} (${r.id})`);
}
const counterAfter = (await counterRef.get()).data().remedies;
console.log(`লেখা সম্পন্ন: ${planned.length} ওষুধ, যাচাই পাশ: ${verified}/${planned.length}, counter.remedies: ${counterAfter}`);
console.log(`baseline এখন ${Object.keys(baseline).length} ওষুধ।`);
process.exit(0);
