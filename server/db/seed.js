import db from './index.js';
import { remedies, rubrics, links } from './data.js';

const t0 = Date.now();

// সিড এখন non-destructive:
// - ওষুধ নাম অনুযায়ী এবং রুব্রিক (section + ইংরেজি টেক্সট) অনুযায়ী upsert হয়,
//   তাই বিদ্যমান ID স্থির থাকে (প্রেসক্রিপশন ভাঙে না)।
// - ব্যবহারকারীর যোগ করা কাস্টম ওষুধ (is_custom = 1) ও তাদের রুব্রিক-লিংক অক্ষত থাকে।
// - data.js থেকে বাদ পড়া সিডেড ওষুধ/রুব্রিক মুছে যায়।

// data.js-এর রুব্রিক টেক্সটের ইংরেজি অংশ (বাংলা বন্ধনী বাদে) — লিংক-কীর সাথে মেলানোর জন্য
const englishOf = (text) => text.replace(/\s*\([^)]*\)\s*$/, '').trim();

db.exec('BEGIN');
try {
  // ১. ওষুধ upsert (নাম অনুযায়ী)
  const findRemedy = db.prepare('SELECT id FROM remedies WHERE name = ? COLLATE NOCASE');
  const insRemedy = db.prepare(
    'INSERT INTO remedies (name, source, keynotes, clinical, better, worse, is_custom) VALUES (?, ?, ?, ?, ?, ?, 0)'
  );
  const updRemedy = db.prepare(
    'UPDATE remedies SET source = ?, keynotes = ?, clinical = ?, better = ?, worse = ? WHERE id = ?'
  );
  const remedyIdByName = new Map();
  for (const r of remedies) {
    const existing = findRemedy.get(r.name);
    if (existing) {
      updRemedy.run(r.source, r.keynotes, r.clinical ?? null, r.better ?? null, r.worse ?? null, existing.id);
      remedyIdByName.set(r.name, existing.id);
    } else {
      const info = insRemedy.run(r.name, r.source, r.keynotes, r.clinical ?? null, r.better ?? null, r.worse ?? null);
      remedyIdByName.set(r.name, info.lastInsertRowid);
    }
  }

  // ২. data.js-এ নেই এমন সিডেড ওষুধ মুছে ফেলো (কাস্টম ওষুধ থাকবে)
  const staleRemedies = db
    .prepare('SELECT id FROM remedies WHERE (is_custom IS NULL OR is_custom = 0)')
    .all()
    .filter((row) => ![...remedyIdByName.values()].includes(row.id));
  const delRemedyLink = db.prepare('DELETE FROM rubric_remedies WHERE remedy_id = ?');
  const delRemedy = db.prepare('DELETE FROM remedies WHERE id = ?');
  for (const row of staleRemedies) {
    delRemedyLink.run(row.id);
    delRemedy.run(row.id);
  }

  // ৩. রুব্রিক upsert ((section, ইংরেজি টেক্সট) অনুযায়ী)
  const findRubric = db.prepare('SELECT id FROM rubrics WHERE section = ? AND rubric_text = ?');
  const insRubric = db.prepare('INSERT INTO rubrics (section, rubric_text) VALUES (?, ?)');
  const rubricIdByKey = new Map();
  const validRubricIds = new Set();
  for (const r of rubrics) {
    const englishText = englishOf(r.text);
    const key = `${r.section} > ${englishText}`;
    const existing = findRubric.get(r.section, r.text);
    if (existing) {
      rubricIdByKey.set(key, existing.id);
      validRubricIds.add(existing.id);
    } else {
      const info = insRubric.run(r.section, r.text);
      rubricIdByKey.set(key, info.lastInsertRowid);
      validRubricIds.add(info.lastInsertRowid);
    }
  }

  // ৪. data.js-এ নেই এমন রুব্রিক মুছে ফেলো (তাদের লিংকও)
  const allRubrics = db.prepare('SELECT id FROM rubrics').all();
  const delRubricLink = db.prepare('DELETE FROM rubric_remedies WHERE rubric_id = ?');
  const delRubric = db.prepare('DELETE FROM rubrics WHERE id = ?');
  for (const row of allRubrics) {
    if (!validRubricIds.has(row.id)) {
      delRubricLink.run(row.id);
      delRubric.run(row.id);
    }
  }

  // ৫. সিডেড ওষুধের লিংক নতুন করে গড়ো; কাস্টম ওষুধের লিংক অক্ষত থাকে
  db.exec('DELETE FROM rubric_remedies WHERE remedy_id IN (SELECT id FROM remedies WHERE is_custom IS NULL OR is_custom = 0)');

  const insLink = db.prepare('INSERT INTO rubric_remedies (rubric_id, remedy_id, grade) VALUES (?, ?, ?)');
  let linked = 0;
  const problems = [];
  for (const [rubricKey, remedyName, grade] of links) {
    const rubricId = rubricIdByKey.get(rubricKey);
    const remedyId = remedyIdByName.get(remedyName);
    if (!rubricId || !remedyId) {
      problems.push(`"${rubricKey}" / "${remedyName}"`);
      continue;
    }
    insLink.run(rubricId, remedyId, grade);
    linked++;
  }

  db.exec('COMMIT');

  const totalRemedies = db.prepare('SELECT COUNT(*) AS n FROM remedies').get().n;
  const totalRubrics = db.prepare('SELECT COUNT(*) AS n FROM rubrics').get().n;
  const totalLinks = db.prepare('SELECT COUNT(*) AS n FROM rubric_remedies').get().n;

  console.log(
    `Seed সম্পন্ন: ${totalRemedies} ওষুধ (${remedies.length} সিডেড + কাস্টম সংরক্ষিত), ${totalRubrics} রুব্রিক, ${totalLinks} লিংক। সময় লেগেছে ${((Date.now() - t0) / 1000).toFixed(2)} সেকেন্ড।`
  );
  if (staleRemedies.length) console.log(`data.js থেকে বাদ পড়া ${staleRemedies.length}টি পুরোনো সিডেড ওষুধ মুছে ফেলা হয়েছে।`);
  if (problems.length) {
    console.warn('সতর্কতা — এই লিংকগুলো মেলেনি:', problems.join(', '));
  }
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Seed ব্যর্থ, রোলব্যাক করা হলো:', err.message);
  process.exit(1);
}
