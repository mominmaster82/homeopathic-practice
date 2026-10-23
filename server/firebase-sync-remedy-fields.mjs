// Targeted ওষুধ-ফিল্ড সিঙ্ক: data.js → Firestore
// - শুধু clinical/keynotes/better/worse ফিল্ড দেখে; নাম, source বা অন্য কিছু বদলায় না।
// - baseline (`db/remedy-baseline.json`) দিয়ে drift ধরে: প্রোডাকশনে যে ফিল্ড ব্যবহারকারী
//   বদলেছেন (prod ≠ baseline) সেখানে হাত দেওয়া হয় না।
// - ডিফল্ট dry-run। আসলে লিখতে: node firebase-sync-remedy-fields.mjs --apply
import { readFileSync, existsSync } from 'node:fs';
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
  console.error('db/remedy-baseline.json পাওয়া যায়নি — drift-সুরক্ষা ছাড়া লেখা হবে না।');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync('./db/remedy-baseline.json', 'utf8'));
const key = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const normName = (name) => String(name ?? '').trim().toLowerCase();
const cut = (text, n = 70) => {
  const s = String(text ?? '').replace(/\s+/g, ' ');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

// ---------- ১. Firestore-এর বর্তমান ওষুধ ----------
const fsDocs = (await db.collection('remedies').get()).docs;
const fsByName = new Map();
const duplicateNames = new Set();
for (const doc of fsDocs) {
  const name = normName(doc.data().name);
  if (!name) continue;
  if (fsByName.has(name)) duplicateNames.add(name);
  else fsByName.set(name, doc);
}

// ---------- ২. তুলনা ----------
const safeUpdates = [];
const alreadySynced = [];
const driftChanged = [];
const driftUntouched = [];
const missingInProd = [];
const missingInLocal = [];
const unknownBaseline = [];
const localNames = new Set();

for (const local of localRemedies) {
  const name = normName(local.name);
  localNames.add(name);
  const base = baseline[local.name];
  const doc = fsByName.get(name);
  if (!doc) {
    missingInProd.push(local.name);
    continue;
  }
  if (!base) {
    unknownBaseline.push(local.name);
    continue;
  }
  const prod = doc.data();
  for (const field of FIELDS) {
    const localValue = String(local[field] ?? '');
    const baseValue = String(base[field] ?? '');
    const prodValue = String(prod[field] ?? '');
    if (localValue === baseValue) {
      // লোকাল অপরিবর্তিত — প্রোডাকশনে ভিন্ন হলে সেটি ব্যবহারকারীর এডিট, স্পর্শ করব না
      if (prodValue !== baseValue) driftUntouched.push({ name: local.name, field, baseValue, prodValue });
      continue;
    }
    if (prodValue === localValue) {
      alreadySynced.push({ name: local.name, field });
    } else if (prodValue === baseValue) {
      safeUpdates.push({ doc, name: local.name, field, baseValue, localValue });
    } else {
      driftChanged.push({ name: local.name, field, baseValue, localValue, prodValue });
    }
  }
}

for (const [name, doc] of fsByName) {
  if (!localNames.has(name)) missingInLocal.push(doc.data().name ?? name);
}

// ---------- ৩. রিপোর্ট ----------
console.log(APPLY ? '=== APPLY মোড: Firestore-এ লেখা হবে ===' : '=== DRY-RUN: কিছুই লেখা হবে না ===');
console.log(`data.js: ${localRemedies.length} ওষুধ | baseline: ${Object.keys(baseline).length} | Firestore: ${fsDocs.length}`);
console.log(`নিরাপদে আপডেটযোগ্য: ${safeUpdates.length} ফিল্ড / ${new Set(safeUpdates.map((u) => u.name)).size} ওষুধ`);
for (const u of safeUpdates) {
  console.log(`  ✓ ${u.name} [${u.field}] ${cut(u.baseValue)} → ${cut(u.localValue)}`);
}
console.log(`আগেই সিঙ্ক হয়েছে: ${alreadySynced.length} ফিল্ড`);
if (alreadySynced.length) {
  console.log('  ' + alreadySynced.map((u) => `${u.name}[${u.field}]`).join(', '));
}
if (driftChanged.length) {
  console.warn(`সতর্কতা — লোকাল পরিবর্তন ও প্রোডাকশন দুটোই ভিন্ন, এড়িয়ে যাওয়া হচ্ছে: ${driftChanged.length}`);
  for (const d of driftChanged) {
    console.warn(`  ⚠ ${d.name} [${d.field}] local: ${cut(d.localValue)} | prod: ${cut(d.prodValue)}`);
  }
}
if (driftUntouched.length) {
  console.log(`প্রোডাকশনে ব্যবহারকারীর এডিট (লোকাল অপরিবর্তিত, হাত দেওয়া হবে না): ${driftUntouched.length} ফিল্ড`);
  for (const d of driftUntouched) {
    console.log(`  • ${d.name} [${d.field}] prod: ${cut(d.prodValue)}`);
  }
}
if (missingInProd.length) console.warn('Firestore-এ নেই:', missingInProd.join(', '));
if (missingInLocal.length) console.warn('data.js-এ নেই:', missingInLocal.join(', '));
if (unknownBaseline.length) console.warn('baseline-এ নেই, এড়িয়ে যাওয়া হচ্ছে:', unknownBaseline.join(', '));
if (duplicateNames.size) console.warn('Firestore-এ একই নামের একাধিক ডক:', [...duplicateNames].join(', '));

if (!APPLY) {
  console.log('লিখতে চাইলে চালান: node firebase-sync-remedy-fields.mjs --apply');
  process.exit(0);
}
if (!safeUpdates.length) {
  console.log('সিঙ্ক করার মতো নিরাপদ ফিল্ড নেই।');
  process.exit(0);
}

// ---------- ৪. শুধু নিরাপদ ফিল্ড লেখা ----------
const bulk = db.bulkWriter();
for (const u of safeUpdates) {
  bulk.update(u.doc.ref, { [u.field]: u.localValue });
}
await bulk.close();

// ---------- ৫. যাচাই ----------
let verified = 0;
const recheck = new Map();
for (const u of safeUpdates) {
  if (!recheck.has(u.doc.ref.path)) recheck.set(u.doc.ref.path, { ref: u.doc.ref, fields: [] });
  recheck.get(u.doc.ref.path).fields.push(u);
}
for (const { ref, fields } of recheck.values()) {
  const snap = await ref.get();
  const data = snap.data() ?? {};
  for (const u of fields) {
    if (String(data[u.field] ?? '') === u.localValue) verified++;
    else console.warn(`যাচাই ব্যর্থ: ${u.name} [${u.field}]`);
  }
}
console.log(`লেখা সম্পন্ন: ${safeUpdates.length} ফিল্ড, যাচাই পাশ: ${verified}/${safeUpdates.length}`);
process.exit(0);
