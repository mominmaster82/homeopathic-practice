import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// ব্যাকআপ এক্সপোর্ট — সব রোগী, কেস, প্রেসক্রিপশন, সেটিংস
router.get('/export', (req, res) => {
  try {
    const patients = db.prepare('SELECT * FROM patients ORDER BY id').all();
    const cases = db.prepare('SELECT * FROM cases ORDER BY id').all();
    const prescriptions = db.prepare('SELECT * FROM prescriptions ORDER BY id').all();
    const settings = db.prepare('SELECT * FROM settings').all();

    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      data: {
        patients,
        cases,
        prescriptions,
        settings,
      },
    };

    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: 'ব্যাকআপ তৈরি ব্যর্থ: ' + err.message });
  }
});

// ব্যাকআপ ইমপোর্ট — সব মুছে নতুন করে ডেটা ঢোকানো
router.post('/import', (req, res) => {
  const backup = req.body;

  // বেসিক ভ্যালিডেশন
  if (!backup || !backup.data) {
    return res.status(400).json({ error: 'অবৈধ ব্যাকআপ ফরম্যাট' });
  }

  const { patients, cases, prescriptions, settings } = backup.data;
  if (!Array.isArray(patients) || !Array.isArray(cases) || !Array.isArray(prescriptions)) {
    return res.status(400).json({ error: 'ব্যাকআপ ডেটা অসম্পূর্ণ' });
  }

  try {
    // ট্রানজ্যাকশনে সব কাজ করি
    db.exec('BEGIN');

    // পুরনো ডেটা মুছি (অর্ডার গুরুত্বপূর্ণ — FK constraint)
    db.exec('DELETE FROM prescriptions');
    db.exec('DELETE FROM cases');
    db.exec('DELETE FROM patients');
    db.exec('DELETE FROM settings');

    // AUTOINCREMENT রিসেট
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('patients', 'cases', 'prescriptions')");

    // নতুন ডেটা ঢোকাই
    const insPatient = db.prepare(
      'INSERT INTO patients (id, name, age, gender, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const p of patients) {
      insPatient.run(p.id, p.name, p.age, p.gender, p.phone, p.created_at);
    }

    const insCase = db.prepare(
      'INSERT INTO cases (id, patient_id, symptoms, notes, date) VALUES (?, ?, ?, ?, ?)'
    );
    for (const c of cases) {
      insCase.run(c.id, c.patient_id, c.symptoms, c.notes, c.date);
    }

    const insRx = db.prepare(
      'INSERT INTO prescriptions (id, case_id, remedy_id, potency, dose) VALUES (?, ?, ?, ?, ?)'
    );
    for (const rx of prescriptions) {
      insRx.run(rx.id, rx.case_id, rx.remedy_id, rx.potency, rx.dose);
    }

    const insSetting = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?)'
    );
    for (const s of settings) {
      insSetting.run(s.key, s.value);
    }

    db.exec('COMMIT');

    res.json({
      ok: true,
      message: `ব্যাকআপ রিস্টোর সম্পন্ন: ${patients.length} রোগী, ${cases.length} কেস, ${prescriptions.length} প্রেসক্রিপশন`,
    });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'ব্যাকআপ রিস্টোর ব্যর্থ: ' + err.message });
  }
});

export default router;
