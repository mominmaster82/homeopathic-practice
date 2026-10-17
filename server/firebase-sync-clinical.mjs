// Clinical সেকশন → Firestore (targeted, idempotent)
// শুধু section='Clinical' রুব্রিক ও তাদের লিংক আপলোড/সিঙ্ক করে — অন্য কোনো ডেটা স্পর্শ করে না।
// চালাতে: node firebase-sync-clinical.mjs   (server ফোল্ডার থেকে)
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!existsSync('./firebase-key.json')) {
  console.error('firebase-key.json পাওয়া যায়নি — Service Account কী এই ফোল্ডারে রাখুন।');
  process.exit(1);
}

const key = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const sqlite = new DatabaseSync('./db/homeopathy.db', { readOnly: true });

const t0 = Date.now();
const rubricRows = sqlite
  .prepare("SELECT id, section, rubric_text FROM rubrics WHERE section = 'Clinical' ORDER BY id")
  .all();
if (rubricRows.length === 0) {
  console.error('SQLite-এ Clinical রুব্রিক নেই — আগে node db/seed.js চালান।');
  process.exit(1);
}

const ids = rubricRows.map((r) => r.id);
const maxId = Math.max(...ids);
const placeholders = ids.map(() => '?').join(',');
const linkRows = sqlite
  .prepare(
    `SELECT rubric_id, remedy_id, grade FROM rubric_remedies WHERE rubric_id IN (${placeholders})`
  )
  .all(...ids);

console.log(`SQLite: ${rubricRows.length} Clinical রুব্রিক (id ${Math.min(...ids)}–${maxId}), ${linkRows.length} লিংক`);

// নিরাপত্তা যাচাই ১ — একই ID-তে ভিন্ন সেকশনের রুব্রিক থাকলে থামো
for (const r of rubricRows) {
  const doc = await db.collection('rubrics').doc(String(r.id)).get();
  if (doc.exists && doc.data().section !== 'Clinical') {
    console.error(`থামানো হলো — Firestore rubrics/${r.id} আগে থেকেই "${doc.data().section}" সেকশনে আছে।`);
    process.exit(1);
  }
}

// নিরাপত্তা যাচাই ২ — লিংকের সব ওষুধ Firestore-এ আছে কি না
const remedyIds = [...new Set(linkRows.map((l) => l.remedy_id))];
const firestoreRemedyIds = new Set((await db.collection('remedies').get()).docs.map((d) => Number(d.id)));
const missingRemedies = remedyIds.filter((id) => !firestoreRemedyIds.has(id));
if (missingRemedies.length) {
  console.error('থামানো হলো — Firestore-এ এই remedy IDগুলো নেই:', missingRemedies.join(', '));
  process.exit(1);
}

// ১. Clinical রুব্রিক upsert (একই ID — idempotent)
const bulk = db.bulkWriter();
for (const r of rubricRows) {
  bulk.set(db.collection('rubrics').doc(String(r.id)), r);
}

// ২. এই রুব্রিকগুলোর পুরোনো লিংক মুছে নতুন করে বসাও (re-run নিরাপদ)
for (let i = 0; i < ids.length; i += 10) {
  const chunk = ids.slice(i, i + 10);
  const snap = await db.collection('rubric_links').where('rubric_id', 'in', chunk).get();
  for (const doc of snap.docs) bulk.delete(doc.ref);
}

// ৩. নতুন লিংক তৈরি (অটো-ID)
for (const link of linkRows) {
  bulk.create(db.collection('rubric_links').doc(), link);
}

await bulk.close();

// ৪. রুব্রিক কাউন্টার বাড়াও — ভবিষ্যতে ক্লায়েন্ট-তৈরি ID যাতে সংঘর্ষ না করে
const counterRef = db.collection('counters').doc('main');
await db.runTransaction(async (tx) => {
  const snap = await tx.get(counterRef);
  const current = snap.exists ? Number(snap.data().rubrics) || 0 : 0;
  if (current < maxId) tx.set(counterRef, { rubrics: maxId }, { merge: true });
});

// যাচাই
const count = async (q) => (await q.count().get()).data().count;
const totalClinical = await count(db.collection('rubrics').where('section', '==', 'Clinical'));
let totalLinks = 0;
for (let i = 0; i < ids.length; i += 10) {
  const chunk = ids.slice(i, i + 10);
  totalLinks += await count(db.collection('rubric_links').where('rubric_id', 'in', chunk));
}

console.log('আপলোড সম্পন্ন:', {
  clinicalRubrics: rubricRows.length,
  clinicalLinks: linkRows.length,
  সময়: ((Date.now() - t0) / 1000).toFixed(1) + 's',
});
console.log(`Firestore যাচাই — Clinical রুব্রিক: ${totalClinical} | Clinical লিংক: ${totalLinks}`);
const counter = await counterRef.get();
console.log('counters/main.rubrics:', counter.data().rubrics);
process.exit(0);
