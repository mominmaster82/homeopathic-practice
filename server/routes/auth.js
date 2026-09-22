import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// ডিফল্ট পাসওয়ার্ড সেটআপ (প্রথমবার)
function ensureDefaultPassword() {
  const existing = db.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get();
  if (!existing || !existing.value) {
    const defaultHash = bcrypt.hashSync('admin', 10);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password_hash', ?)").run(defaultHash);
    console.log('ডিফল্ট পাসওয়ার্ড সেট হয়েছে: admin (প্রথম লগইনের পর পরিবর্তন করুন)');
  }
}
ensureDefaultPassword();

// লগইন
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'পাসওয়ার্ড দিন' });
  }

  const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get();
  if (!row) {
    return res.status(500).json({ error: 'পাসওয়ার্ড সেটআপ হয়নি' });
  }

  const match = bcrypt.compareSync(password, row.value);
  if (!match) {
    return res.status(401).json({ error: 'ভুল পাসওয়ার্ড' });
  }

  // JWT টোকেন তৈরি (৭ দিন মেয়াদ)
  const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// পাসওয়ার্ড পরিবর্তন (সুরক্ষিত — টোকেন লাগবে)
router.post('/change-password', verifyToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'পুরনো ও নতুন পাসওয়ার্ড দিন' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে' });
  }

  const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get();
  if (!row) {
    return res.status(500).json({ error: 'পাসওয়ার্ড সেটআপ হয়নি' });
  }

  // পুরনো পাসওয়ার্ড যাচাই
  const match = bcrypt.compareSync(currentPassword, row.value);
  if (!match) {
    return res.status(401).json({ error: 'পুরনো পাসওয়ার্ড ভুল' });
  }

  // নতুন পাসওয়ার্ড হ্যাশ করে সংরক্ষণ
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE settings SET value = ? WHERE key = 'admin_password_hash'").run(newHash);

  res.json({ ok: true, message: 'পাসওয়ার্ড পরিবর্তিত হয়েছে' });
});

export default router;
