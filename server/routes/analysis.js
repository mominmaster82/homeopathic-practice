import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// রেপার্টরাইজেশন: নির্বাচিত রুব্রিক থেকে ওষুধের স্কোর হিসাব
// বডি: { rubricIds: [1, 2, 5] }
router.post('/', (req, res) => {
  const { rubricIds } = req.body;
  if (!Array.isArray(rubricIds) || rubricIds.length === 0) {
    return res.status(400).json({ error: 'কমপক্ষে একটি রুব্রিক নির্বাচন করুন' });
  }

  const scores = new Map(); // remedy_id -> { remedy, total, hits }
  const getLinks = db.prepare(
    `SELECT r.id AS remedy_id, r.name, r.source, r.keynotes, rr.grade
     FROM rubric_remedies rr
     JOIN remedies r ON r.id = rr.remedy_id
     WHERE rr.rubric_id = ?`
  );

  for (const rubricId of rubricIds) {
    for (const row of getLinks.all(rubricId)) {
      const entry = scores.get(row.remedy_id) || {
        remedy_id: row.remedy_id,
        name: row.name,
        source: row.source,
        keynotes: row.keynotes,
        total: 0,
        hits: 0,
      };
      entry.total += row.grade;
      entry.hits += 1;
      scores.set(row.remedy_id, entry);
    }
  }

  const results = [...scores.values()].sort((a, b) => b.total - a.total);
  res.json(results);
});

export default router;
