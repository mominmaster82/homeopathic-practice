import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// যেসব কী সংরক্ষণের অনুমতি আছে
const ALLOWED = [
  'clinic_name',
  'doctor_name',
  'address',
  'phone',
  'email',
  'footer_note',
  'logo',
];

function readAll() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// সব সেটিংস
router.get('/', (req, res) => {
  res.json(readAll());
});

// সেটিংস হালনাগাদ (আংশিকও হতে পারে)
router.put('/', (req, res) => {
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  for (const k of ALLOWED) {
    if (k in req.body) upsert.run(k, req.body[k] == null ? '' : String(req.body[k]));
  }
  res.json(readAll());
});

export default router;
