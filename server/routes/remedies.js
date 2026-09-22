import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// সব ওষুধ
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM remedies ORDER BY name').all();
  res.json(rows);
});

// একক ওষুধ (বিস্তারিত)
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM remedies WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'ওষুধ পাওয়া যায়নি' });
  res.json(row);
});

// ওষুধের রেপার্টরি প্রোফাইল — কোন কোন রুব্রিকে এই ওষুধ আছে (গ্রেড সহ)
router.get('/:id/rubrics', (req, res) => {
  const remedy = db.prepare('SELECT id FROM remedies WHERE id = ?').get(req.params.id);
  if (!remedy) return res.status(404).json({ error: 'ওষুধ পাওয়া যায়নি' });
  const rows = db
    .prepare(
      `SELECT r.id, r.section, r.rubric_text, rr.grade
       FROM rubric_remedies rr
       JOIN rubrics r ON r.id = rr.rubric_id
       WHERE rr.remedy_id = ?
       ORDER BY rr.grade DESC, r.section, r.rubric_text`
    )
    .all(req.params.id);
  res.json(rows);
});

// নতুন কাস্টম ওষুধ যোগ
router.post('/', (req, res) => {
  const { name, source, keynotes, clinical, better, worse } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'ওষুধের নাম দিতে হবে' });

  const dup = db.prepare('SELECT id FROM remedies WHERE name = ? COLLATE NOCASE').get(name.trim());
  if (dup) return res.status(409).json({ error: 'এই নামে ওষুধ আগে থেকেই আছে' });

  const info = db
    .prepare(
      'INSERT INTO remedies (name, source, keynotes, clinical, better, worse, is_custom) VALUES (?, ?, ?, ?, ?, ?, 1)'
    )
    .run(name.trim(), source ?? null, keynotes ?? null, clinical ?? null, better ?? null, worse ?? null);

  const row = db.prepare('SELECT * FROM remedies WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

// ওষুধ সম্পাদনা
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM remedies WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'ওষুধ পাওয়া যায়নি' });

  const { name, source, keynotes, clinical, better, worse } = req.body;
  const newName = (name ?? existing.name).trim();
  if (!newName) return res.status(400).json({ error: 'ওষুধের নাম খালি হতে পারে না' });

  const dup = db
    .prepare('SELECT id FROM remedies WHERE name = ? COLLATE NOCASE AND id != ?')
    .get(newName, existing.id);
  if (dup) return res.status(409).json({ error: 'এই নামে আরেকটি ওষুধ আছে' });

  db.prepare(
    'UPDATE remedies SET name = ?, source = ?, keynotes = ?, clinical = ?, better = ?, worse = ? WHERE id = ?'
  ).run(
    newName,
    source !== undefined ? source : existing.source,
    keynotes !== undefined ? keynotes : existing.keynotes,
    clinical !== undefined ? clinical : existing.clinical,
    better !== undefined ? better : existing.better,
    worse !== undefined ? worse : existing.worse,
    existing.id
  );

  res.json(db.prepare('SELECT * FROM remedies WHERE id = ?').get(existing.id));
});

// কাস্টম ওষুধ মুছে ফেলা (সিডেড ওষুধ মুছে ফেলা যাবে না)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM remedies WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'ওষুধ পাওয়া যায়নি' });
  if (!existing.is_custom) {
    return res.status(403).json({ error: 'রেফারেন্স ডেটাসেটের ওষুধ মুছে ফেলা যাবে না — শুধু নিজের যোগ করা ওষুধ মুছতে পারবেন' });
  }

  const used = db.prepare('SELECT COUNT(*) AS n FROM prescriptions WHERE remedy_id = ?').get(existing.id);
  if (used.n > 0) {
    return res.status(409).json({ error: 'এই ওষুধটি প্রেসক্রিপশনে ব্যবহৃত হয়েছে, তাই মুছে ফেলা যাবে না' });
  }

  db.prepare('DELETE FROM rubric_remedies WHERE remedy_id = ?').run(existing.id);
  db.prepare('DELETE FROM remedies WHERE id = ?').run(existing.id);
  res.json({ ok: true, message: 'ওষুধ মুছে ফেলা হয়েছে' });
});

// ওষুধের সাথে রুব্রিক যুক্ত করা (গ্রেড সহ)
router.post('/:id/rubrics', (req, res) => {
  const { rubric_id, grade } = req.body;
  const remedy = db.prepare('SELECT id FROM remedies WHERE id = ?').get(req.params.id);
  if (!remedy) return res.status(404).json({ error: 'ওষুধ পাওয়া যায়নি' });

  const rubric = db.prepare('SELECT id FROM rubrics WHERE id = ?').get(rubric_id);
  if (!rubric) return res.status(404).json({ error: 'রুব্রিক পাওয়া যায়নি' });

  const g = Number(grade);
  if (!Number.isInteger(g) || g < 1 || g > 3) {
    return res.status(400).json({ error: 'গ্রেড ১, ২ বা ৩ হতে হবে' });
  }

  const existingLink = db
    .prepare('SELECT id FROM rubric_remedies WHERE remedy_id = ? AND rubric_id = ?')
    .get(remedy.id, rubric.id);
  if (existingLink) {
    db.prepare('UPDATE rubric_remedies SET grade = ? WHERE id = ?').run(g, existingLink.id);
  } else {
    db.prepare('INSERT INTO rubric_remedies (rubric_id, remedy_id, grade) VALUES (?, ?, ?)').run(rubric.id, remedy.id, g);
  }

  res.status(201).json({ ok: true });
});

// লিংকের গ্রেড পরিবর্তন
router.put('/:id/rubrics/:rubricId', (req, res) => {
  const { grade } = req.body;
  const g = Number(grade);
  if (!Number.isInteger(g) || g < 1 || g > 3) {
    return res.status(400).json({ error: 'গ্রেড ১, ২ বা ৩ হতে হবে' });
  }

  const info = db
    .prepare('UPDATE rubric_remedies SET grade = ? WHERE remedy_id = ? AND rubric_id = ?')
    .run(g, req.params.id, req.params.rubricId);
  if (info.changes === 0) return res.status(404).json({ error: 'লিংক পাওয়া যায়নি' });
  res.json({ ok: true });
});

// ওষুধ থেকে রুব্রিক লিংক মুছে ফেলা
router.delete('/:id/rubrics/:rubricId', (req, res) => {
  const info = db
    .prepare('DELETE FROM rubric_remedies WHERE remedy_id = ? AND rubric_id = ?')
    .run(req.params.id, req.params.rubricId);
  if (info.changes === 0) return res.status(404).json({ error: 'লিংক পাওয়া যায়নি' });
  res.json({ ok: true, message: 'রুব্রিক লিংক মুছে ফেলা হয়েছে' });
});

export default router;
