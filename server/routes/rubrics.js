import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// সব রুব্রিক (ঐচ্ছিক: section অনুযায়ী ফিল্টার)
router.get('/', (req, res) => {
  const { section } = req.query;
  const rows = section
    ? db.prepare('SELECT * FROM rubrics WHERE section = ? ORDER BY rubric_text').all(section)
    : db.prepare('SELECT * FROM rubrics ORDER BY section, rubric_text').all();
  res.json(rows);
});

// আলাদা শাখার (section) তালিকা
router.get('/sections', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT section FROM rubrics ORDER BY section').all();
  res.json(rows.map((r) => r.section));
});

// একটা রুব্রিকের সাথে যুক্ত ওষুধ
router.get('/:id/remedies', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.name, rr.grade
       FROM rubric_remedies rr
       JOIN remedies r ON r.id = rr.remedy_id
       WHERE rr.rubric_id = ?
       ORDER BY rr.grade DESC, r.name`
    )
    .all(req.params.id);
  res.json(rows);
});

export default router;
