import db from './index.js';
import { remedies, rubrics, links } from './data.js';

const t0 = Date.now();

// পুরো সিড একটি ট্রানজ্যাকশনে — প্রতিটি ইনসার্ট আলাদা কমিট না করে
// একবারে ডিস্কে লেখা হয়, তাই অনেক দ্রুত।
db.exec('BEGIN');
try {
  // রেফারেন্স টেবিলগুলো নতুন করে গড়ি (রোগী/কেস/প্রেসক্রিপশন অপরিবর্তিত থাকবে)
  db.exec('DELETE FROM rubric_remedies');
  db.exec('DELETE FROM remedies');
  db.exec('DELETE FROM rubrics');

  const insRemedy = db.prepare(
    'INSERT INTO remedies (name, source, keynotes, clinical, better, worse) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const r of remedies)
    insRemedy.run(r.name, r.source, r.keynotes, r.clinical ?? null, r.better ?? null, r.worse ?? null);

  const insRubric = db.prepare('INSERT INTO rubrics (section, rubric_text) VALUES (?, ?)');
  const rubricIdByKey = new Map(); // "section > text" -> id
  for (const r of rubrics) {
    const info = insRubric.run(r.section, r.text);
    // লিংক-কী ইংরেজি অংশ ব্যবহার করে, তাই টেক্সটের শেষের "(...)" অংশ বাদ দিই
    const englishText = r.text.replace(/\s*\([^)]*\)\s*$/, '').trim();
    rubricIdByKey.set(`${r.section} > ${englishText}`, info.lastInsertRowid);
  }

  const remedyIdByName = new Map();
  for (const row of db.prepare('SELECT id, name FROM remedies').all()) {
    remedyIdByName.set(row.name, row.id);
  }

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

  console.log(
    `Seed সম্পন্ন: ${remedies.length} ওষুধ, ${rubrics.length} রুব্রিক, ${linked} লিংক। সময় লেগেছে ${((Date.now() - t0) / 1000).toFixed(2)} সেকেন্ড।`
  );
  if (problems.length) {
    console.warn('সতর্কতা — এই লিংকগুলো মেলেনি:', problems.join(', '));
  }
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Seed ব্যর্থ, রোলব্যাক করা হলো:', err.message);
  process.exit(1);
}
