import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// একজন রোগীর সব কেস (?patient_id=..)
router.get('/', (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id আবশ্যক' });
  const rows = db
    .prepare('SELECT * FROM cases WHERE patient_id = ? ORDER BY date DESC')
    .all(patient_id);
  res.json(rows);
});

// সাম্প্রতিক কেস (রোগীর নামসহ) + মোট কেস সংখ্যা
router.get('/recent', (req, res) => {
  const limit = Number(req.query.limit) || 5;
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM cases').get();
  const recent = db
    .prepare(
      `SELECT c.id, c.date, c.symptoms, c.patient_id, p.name AS patient_name
       FROM cases c
       JOIN patients p ON p.id = c.patient_id
       ORDER BY c.date DESC
       LIMIT ?`
    )
    .all(limit);
  res.json({ total, recent });
});

// একটি কেসের বিস্তারিত + তার প্রেসক্রিপশন (ওষুধের নামসহ)
router.get('/:id', (req, res) => {
  const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  if (!caseRow) return res.status(404).json({ error: 'কেস পাওয়া যায়নি' });

  const prescriptions = db
    .prepare(
      `SELECT p.id, p.potency, p.dose, r.id AS remedy_id, r.name AS remedy_name
       FROM prescriptions p
       JOIN remedies r ON r.id = p.remedy_id
       WHERE p.case_id = ?
       ORDER BY p.id`
    )
    .all(req.params.id);

  res.json({ ...caseRow, prescriptions });
});

// নতুন কেস
router.post('/', (req, res) => {
  const { patient_id, symptoms, notes } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'রোগী নির্বাচন করুন' });

  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patient_id);
  if (!patient) return res.status(404).json({ error: 'রোগী পাওয়া যায়নি' });

  const info = db
    .prepare('INSERT INTO cases (patient_id, symptoms, notes) VALUES (?, ?, ?)')
    .run(patient_id, symptoms ?? null, notes ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// কেস সম্পাদনা
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'কেস পাওয়া যায়নি' });

  const { symptoms, notes } = req.body;
  db.prepare('UPDATE cases SET symptoms = ?, notes = ? WHERE id = ?').run(
    symptoms ?? existing.symptoms,
    notes ?? existing.notes,
    req.params.id
  );
  res.json({ ok: true });
});

// কেস মুছে ফেলা (সংশ্লিষ্ট প্রেসক্রিপশনও মুছবে)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'কেস পাওয়া যায়নি' });

  db.prepare('DELETE FROM prescriptions WHERE case_id = ?').run(req.params.id);
  db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// কেসে প্রেসক্রিপশন যোগ
router.post('/:id/prescriptions', (req, res) => {
  const { remedy_id, potency, dose } = req.body;
  const caseRow = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.id);
  if (!caseRow) return res.status(404).json({ error: 'কেস পাওয়া যায়নি' });
  if (!remedy_id) return res.status(400).json({ error: 'ওষুধ নির্বাচন করুন' });

  const remedy = db.prepare('SELECT id FROM remedies WHERE id = ?').get(remedy_id);
  if (!remedy) return res.status(404).json({ error: 'ওষুধ পাওয়া যায়নি' });

  const info = db
    .prepare('INSERT INTO prescriptions (case_id, remedy_id, potency, dose) VALUES (?, ?, ?, ?)')
    .run(req.params.id, remedy_id, potency ?? null, dose ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// প্রেসক্রিপশন সম্পাদনা
router.put('/:id/prescriptions/:prescriptionId', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM prescriptions WHERE id = ? AND case_id = ?')
    .get(req.params.prescriptionId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'প্রেসক্রিপশন পাওয়া যায়নি' });

  const { remedy_id, potency, dose } = req.body;
  if (remedy_id !== undefined && remedy_id !== null) {
    const remedy = db.prepare('SELECT id FROM remedies WHERE id = ?').get(remedy_id);
    if (!remedy) return res.status(404).json({ error: 'ওষুধ পাওয়া যায়নি' });
  }

  db.prepare(
    'UPDATE prescriptions SET remedy_id = ?, potency = ?, dose = ? WHERE id = ?'
  ).run(
    remedy_id ?? existing.remedy_id,
    potency ?? existing.potency,
    dose ?? existing.dose,
    req.params.prescriptionId
  );
  res.json({ ok: true });
});

// প্রেসক্রিপশন মুছে ফেলা
router.delete('/:id/prescriptions/:prescriptionId', (req, res) => {
  const info = db
    .prepare('DELETE FROM prescriptions WHERE id = ? AND case_id = ?')
    .run(req.params.prescriptionId, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'প্রেসক্রিপশন পাওয়া যায়নি' });
  res.json({ ok: true });
});

export default router;
