// Targeted রুব্রিক সিঙ্ক: SQLite → Firestore
// - (section, rubric_text) মিলিয়ে শুধু অনুপস্থিত রুব্রিক যোগ করে; কোনো ডেটা মোছে না।
// - নতুন ID Firestore-এর বর্তমান সর্বোচ্চ numeric ID থেকে নেওয়া হয় (counter নয়)।
// - লিংক আগে থেকে আছে কিনা যাচাই করে; ডুপ্লিকেট তৈরি করে না।
// - ডিফল্ট dry-run। আসলে লিখতে: node firebase-sync-rubrics.mjs --apply
// (server ফোল্ডার থেকে চালান; firebase-key.json এখানে থাকতে হবে)
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

if (!existsSync('./firebase-key.json')) {
  console.error('firebase-key.json পাওয়া যায়নি — Service Account কী এই ফোল্ডারে রাখুন।');
  process.exit(1);
}

const key = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const sqlite = new DatabaseSync('./db/homeopathy.db', { readOnly: true });

const t0 = Date.now();
const chunks = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// স্পেস/বন্ধনীর ফাঁক ভিন্ন হলেও একই রুব্রিক ধরতে whitespace বাদ দিয়ে মেলাই
const keyOf = (section, text) => `${section}||${String(text).replace(/\s+/g, '')}`;

// ---------- ১. লোকাল ডেটা ----------
const localRubrics = sqlite
  .prepare('SELECT id, section, rubric_text FROM rubrics ORDER BY id')
  .all();
const localLinks = sqlite.prepare('SELECT rubric_id, remedy_id, grade FROM rubric_remedies').all();
const localRemedyName = new Map(
  sqlite.prepare('SELECT id, name FROM remedies').all().map((r) => [r.id, r.name])
);

// ---------- ২. Firestore-এর বর্তমান অবস্থা ----------
const fsRubricDocs = (await db.collection('rubrics').get()).docs;
let maxRubricId = 0;
const existingRubricByKey = new Map();
for (const doc of fsRubricDocs) {
  const data = doc.data();
  const id = Number(data.id ?? doc.id);
  if (Number.isFinite(id)) maxRubricId = Math.max(maxRubricId, id);
  if (!data.section || !data.rubric_text) continue;
  const key = keyOf(data.section, data.rubric_text);
  if (!existingRubricByKey.has(key)) existingRubricByKey.set(key, id);
}

const missingRubrics = localRubrics.filter(
  (r) => !existingRubricByKey.has(keyOf(r.section, r.rubric_text))
);

// ---------- ৩. নতুন রুব্রিকের ID পরিকল্পনা ----------
const addRubrics = [];
const targetIdByLocal = new Map();
let nextId = maxRubricId + 1;
for (const r of localRubrics) {
  const key = keyOf(r.section, r.rubric_text);
  const existingId = existingRubricByKey.get(key);
  if (existingId != null) {
    targetIdByLocal.set(r.id, existingId);
  } else {
    targetIdByLocal.set(r.id, nextId);
    addRubrics.push({ id: nextId, section: r.section, rubric_text: r.rubric_text });
    nextId++;
  }
}

// ---------- ৪. ওষুধের নাম → Firestore ID ----------
const fsRemedyDocs = (await db.collection('remedies').get()).docs;
const fsRemedyIdByName = new Map();
for (const doc of fsRemedyDocs) {
  const data = doc.data();
  const name = String(data.name ?? '').trim().toLowerCase();
  if (!name) continue;
  const id = Number(data.id ?? doc.id);
  if (Number.isFinite(id) && !fsRemedyIdByName.has(name)) fsRemedyIdByName.set(name, id);
}

const plannedLinks = [];
const missingRemedies = new Set();
const missingLocalRemedies = new Set();
for (const link of localLinks) {
  const rubricId = targetIdByLocal.get(link.rubric_id);
  if (rubricId == null) continue;
  const name = localRemedyName.get(link.remedy_id);
  if (!name) {
    missingLocalRemedies.add(link.remedy_id);
    continue;
  }
  const remedyId = fsRemedyIdByName.get(String(name).trim().toLowerCase());
  if (remedyId == null) {
    missingRemedies.add(name);
    continue;
  }
  plannedLinks.push({ rubric_id: rubricId, remedy_id: remedyId, grade: link.grade });
}

// ---------- ৫. আগে থেকে থাকা লিংক ----------
const existingLinkPairs = new Set();
const targetRubricIds = [...new Set(plannedLinks.map((l) => l.rubric_id))];
for (const chunk of chunks(targetRubricIds)) {
  const snap = await db.collection('rubric_links').where('rubric_id', 'in', chunk).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    existingLinkPairs.add(`${d.rubric_id}||${d.remedy_id}`);
  }
}
const addLinks = plannedLinks.filter(
  (l) => !existingLinkPairs.has(`${l.rubric_id}||${l.remedy_id}`)
);

// লিংক পরিকল্পনায় একই জোড়া দুইবার থাকলে একবারই রাখো
const seenPairs = new Set();
const uniqueAddLinks = [];
for (const l of addLinks) {
  const pair = `${l.rubric_id}||${l.remedy_id}`;
  if (seenPairs.has(pair)) continue;
  seenPairs.add(pair);
  uniqueAddLinks.push(l);
}

// ---------- ৬. কাউন্টার পরিকল্পনা ----------
const counterRef = db.collection('counters').doc('main');
const counterSnap = await counterRef.get();
const currentCounter = counterSnap.exists ? Number(counterSnap.data().rubrics) || 0 : 0;
const requiredCounter = Math.max(maxRubricId, ...addRubrics.map((r) => r.id));
const nextCounter = Math.max(currentCounter, requiredCounter);

// ---------- ৭. রিপোর্ট ----------
console.log(APPLY ? '=== APPLY মোড: Firestore-এ লেখা হবে ===' : '=== DRY-RUN: কিছুই লেখা হবে না ===');
console.log(`SQLite: ${localRubrics.length} রুব্রিক, ${localLinks.length} লিংক`);
console.log(`Firestore: ${fsRubricDocs.length} রুব্রিক | বর্তমান সর্বোচ্চ ID: ${maxRubricId}`);
console.log(`যোগ করতে হবে: ${addRubrics.length} রুব্রিক`);
if (addRubrics.length) {
  console.log(`  নতুন ID: ${addRubrics[0].id}–${addRubrics[addRubrics.length - 1].id}`);
  const bySection = {};
  for (const r of addRubrics) bySection[r.section] = (bySection[r.section] || 0) + 1;
  console.log('  সেকশনভেদে:', JSON.stringify(bySection));
}
console.log(`লিংক: পরিকল্পিত ${plannedLinks.length} | আগে আছে ${existingLinkPairs.size} | যোগ করতে হবে ${uniqueAddLinks.length}`);
console.log(`কাউন্টার counters/main.rubrics: ${currentCounter} → ${nextCounter}${nextCounter === currentCounter ? ' (অপরিবর্তিত)' : ''}`);
if (missingRemedies.size) {
  console.warn('সতর্কতা — Firestore-এ নাম মেলেনি:', [...missingRemedies].join(', '));
}
if (missingLocalRemedies.size) {
  console.warn('সতর্কতা — লোকাল remedy ID পাওয়া যায়নি:', [...missingLocalRemedies].join(', '));
}

if (!APPLY) {
  console.log('লিখতে চাইলে চালান: node firebase-sync-rubrics.mjs --apply');
  process.exit(0);
}
if (addRubrics.length === 0 && uniqueAddLinks.length === 0 && nextCounter === currentCounter) {
  console.log('সিঙ্ক করার কিছু নেই — Firestore আগে থেকেই হালনাগাদ।');
  process.exit(0);
}

// ---------- ৮. লেখা ----------
const bulk = db.bulkWriter();
for (const r of addRubrics) {
  bulk.create(db.collection('rubrics').doc(String(r.id)), r);
}
for (const link of uniqueAddLinks) {
  bulk.create(db.collection('rubric_links').doc(), link);
}
await bulk.close();

if (nextCounter > currentCounter) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const latest = snap.exists ? Number(snap.data().rubrics) || 0 : 0;
    if (latest < nextCounter) tx.set(counterRef, { rubrics: nextCounter }, { merge: true });
  });
}

// ---------- ৯. যাচাই ----------
const verifyRubricIds = addRubrics.map((r) => r.id);
let addedRubricCount = 0;
for (const chunk of chunks(verifyRubricIds)) {
  const snap = await db.collection('rubrics').where('id', 'in', chunk).get();
  addedRubricCount += snap.size;
}
let addedLinkCount = 0;
const addedLinkIds = [...new Set(uniqueAddLinks.map((l) => l.rubric_id))];
for (const chunk of chunks(addedLinkIds)) {
  addedLinkCount += (
    await db.collection('rubric_links').where('rubric_id', 'in', chunk).count().get()
  ).data().count;
}
const counterAfter = await counterRef.get();

console.log('সিঙ্ক সম্পন্ন:', {
  rubricsAdded: addedRubricCount,
  linksAdded: uniqueAddLinks.length,
  linkTotalForTargets: addedLinkCount,
  counter: counterAfter.data()?.rubrics,
  সময়: ((Date.now() - t0) / 1000).toFixed(1) + 's',
});
process.exit(0);
