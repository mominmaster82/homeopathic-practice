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

export default router;
