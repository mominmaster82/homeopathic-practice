// SQLite → Firestore মাইগ্রেশন স্ক্রিপ্ট
// চালাতে: node firebase-upload.mjs   (server ফোল্ডার থেকে)
// firebase-key.json (Service Account) এই ফোল্ডারে থাকতে হবে।
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!existsSync('./firebase-key.json')) {
  console.error('firebase-key.json পাওয়া যায়নি — Service Account কী এই ফোল্ডারে রাখুন।');
  process.exit(1);
}

const key = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const sqlite = new DatabaseSync('./db/homeopathy.db', { readOnly: true });

const t0 = Date.now();
const bulk = db.bulkWriter();
let total = 0;

// সংখ্যা-আইডিওয়ালা টেবিল হুবহু একই ID সহ আপলোড
function uploadTable(table, collection) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  for (const row of rows) {
    bulk.set(db.collection(collection).doc(String(row.id)), row);
    total++;
  }
  return rows;
}

const remedies = uploadTable('remedies', 'remedies');
const rubrics = uploadTable('rubrics', 'rubrics');
const patients = uploadTable('patients', 'patients');
const cases = uploadTable('cases', 'cases');
const prescriptions = uploadTable('prescriptions', 'prescriptions');

// rubric_remedies → rubric_links (যৌগ-কী নেই, তাই অটো ID)
const links = sqlite.prepare('SELECT rubric_id, remedy_id, grade FROM rubric_remedies').all();
for (const link of links) {
  bulk.create(db.collection('rubric_links').doc(), link);
  total++;
}

// settings সারি → একটি ডকুমেন্ট settings/clinic
const settingsRows = sqlite.prepare('SELECT key, value FROM settings').all();
const settingsDoc = {};
for (const s of settingsRows) settingsDoc[s.key] = s.value;
// পাসওয়ার্ড-হ্যাশ Firestore-এ দরকার নেই (Firebase Auth ব্যবহার হবে)
delete settingsDoc.admin_password_hash;
bulk.set(db.collection('settings').doc('clinic'), settingsDoc);
total++;

// counters — নতুন রেকর্ডের পরবর্তী ID (ক্লায়েন্ট ট্রানজ্যাকশনে বাড়াবে)
const maxOf = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0);
bulk.set(db.collection('counters').doc('main'), {
  remedies: maxOf(remedies),
  rubrics: maxOf(rubrics),
  patients: maxOf(patients),
  cases: maxOf(cases),
  prescriptions: maxOf(prescriptions),
});
total++;

await bulk.close();

// যাচাই: কয়েকটি কাউন্ট পড়ে মেলানো
const count = async (c) => (await db.collection(c).count().get()).data().count;
console.log('আপলোড সম্পন্ন:', {
  remedies: remedies.length,
  rubrics: rubrics.length,
  rubric_links: links.length,
  patients: patients.length,
  cases: cases.length,
  prescriptions: prescriptions.length,
  মোট: total,
  সময়: ((Date.now() - t0) / 1000).toFixed(1) + 's',
});
console.log('Firestore যাচাই — remedies:', await count('remedies'),
  '| rubrics:', await count('rubrics'),
  '| rubric_links:', await count('rubric_links'),
  '| patients:', await count('patients'));

const aconite = await db.collection('remedies').doc('367').get();
console.log('নমুনা ডক (remedies/367):', aconite.exists ? aconite.data().name : 'পাওয়া যায়নি!');
process.exit(0);
