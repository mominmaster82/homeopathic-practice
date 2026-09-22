import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// সব রোগী (ঐচ্ছিক সার্চ: ?q=নাম বা ফোন)
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const rows = q
    ? db
        .prepare(
          `SELECT * FROM patients
           WHERE name LIKE ? OR phone LIKE ?
           ORDER BY created_at DESC`
        )
        .all(`%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
  res.json(rows);
});

// একজন রোগী
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'রোগী পাওয়া যায়নি' });
  res.json(row);
});

// রোগীর সম্পূর্ণ প্রোফাইল — সব কেস + প্রতিটি কেসের প্রেসক্রিপশন একসাথে
router.get('/:id/profile', (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'রোগী পাওয়া যায়নি' });

  const cases = db
    .prepare('SELECT * FROM cases WHERE patient_id = ? ORDER BY date DESC')
    .all(req.params.id);

  const rxStmt = db.prepare(
    `SELECT p.id, p.potency, p.dose, p.remedy_id, r.name AS remedy_name
     FROM prescriptions p
     JOIN remedies r ON r.id = p.remedy_id
     WHERE p.case_id = ?
     ORDER BY p.id`
  );
  const withRx = cases.map((c) => ({ ...c, prescriptions: rxStmt.all(c.id) }));

  res.json({ ...patient, cases: withRx });
});

// নতুন রোগী
router.post('/', (req, res) => {
  const { name, age, gender, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'নাম আবশ্যক' });
  const info = db
    .prepare('INSERT INTO patients (name, age, gender, phone) VALUES (?, ?, ?, ?)')
    .run(name, age ?? null, gender ?? null, phone ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// রোগী সম্পাদনা
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'রোগী পাওয়া যায়নি' });

  const { name, age, gender, phone } = req.body;
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'নাম খালি রাখা যাবে না' });
  }

  db.prepare(
    'UPDATE patients SET name = ?, age = ?, gender = ?, phone = ? WHERE id = ?'
  ).run(
    name ?? existing.name,
    age ?? existing.age,
    gender ?? existing.gender,
    phone ?? existing.phone,
    req.params.id
  );
  res.json({ ok: true });
});

// রোগী মুছে ফেলা (সংশ্লিষ্ট কেস ও প্রেসক্রিপশনও মুছবে)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM patients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'রোগী পাওয়া যায়নি' });

  const caseIds = db
    .prepare('SELECT id FROM cases WHERE patient_id = ?')
    .all(req.params.id)
    .map((c) => c.id);

  for (const caseId of caseIds) {
    db.prepare('DELETE FROM prescriptions WHERE case_id = ?').run(caseId);
  }
  db.prepare('DELETE FROM cases WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);

  res.json({ ok: true });
});

export default router;
