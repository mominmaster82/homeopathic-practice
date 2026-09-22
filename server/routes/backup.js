import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// ব্যাকআপ এক্সপোর্ট — সব রোগী, কেস, প্রেসক্রিপশন, সেটিংস + ব্যবহারকারীর যোগ করা ওষুধ
router.get('/export', (req, res) => {
  try {
    const patients = db.prepare('SELECT * FROM patients ORDER BY id').all();
    const cases = db.prepare('SELECT * FROM cases ORDER BY id').all();
    const prescriptions = db.prepare('SELECT * FROM prescriptions ORDER BY id').all();
    const settings = db.prepare('SELECT * FROM settings').all();

    // কাস্টম ওষুধ ও তাদের রুব্রিক-লিংক (পোর্টেবিল ন্যাচারাল কী-তে — ID নয়)
    const customRemedies = db
      .prepare('SELECT name, source, keynotes, clinical, better, worse FROM remedies WHERE is_custom = 1 ORDER BY id')
      .all();
    const customRemedyLinks = db
      .prepare(
        `SELECT rem.name AS remedy_name, r.section AS rubric_section, r.rubric_text, rr.grade
         FROM rubric_remedies rr
         JOIN remedies rem ON rem.id = rr.remedy_id
         JOIN rubrics r ON r.id = rr.rubric_id
         WHERE rem.is_custom = 1
         ORDER BY rr.id`
      )
      .all();

    const backup = {
      version: 2,
      exported_at: new Date().toISOString(),
      data: {
        patients,
        cases,
        prescriptions,
        settings,
        custom_remedies: customRemedies,
        custom_remedy_links: customRemedyLinks,
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

  const { patients, cases, prescriptions, settings, custom_remedies, custom_remedy_links } = backup.data;
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

    // ব্যাকআপের কাস্টম ওষুধ ফিরিয়ে আনি (পুরোনো ভার্শনের ব্যাকআপে না-ও থাকতে পারে)
    let restoredRemedies = 0;
    let restoredLinks = 0;
    if (Array.isArray(custom_remedies)) {
      const findRemedy = db.prepare('SELECT id FROM remedies WHERE name = ? COLLATE NOCASE');
      const insRemedy = db.prepare(
        'INSERT INTO remedies (name, source, keynotes, clinical, better, worse, is_custom) VALUES (?, ?, ?, ?, ?, ?, 1)'
      );
      const updRemedy = db.prepare(
        'UPDATE remedies SET source = ?, keynotes = ?, clinical = ?, better = ?, worse = ?, is_custom = 1 WHERE id = ?'
      );
      for (const r of custom_remedies) {
        if (!r.name) continue;
        const existing = findRemedy.get(r.name);
        if (existing) {
          updRemedy.run(r.source ?? null, r.keynotes ?? null, r.clinical ?? null, r.better ?? null, r.worse ?? null, existing.id);
        } else {
          insRemedy.run(r.name, r.source ?? null, r.keynotes ?? null, r.clinical ?? null, r.better ?? null, r.worse ?? null);
        }
        restoredRemedies++;
      }
    }
    if (Array.isArray(custom_remedy_links)) {
      const findLink = db.prepare(
        `SELECT rr.id FROM rubric_remedies rr
         JOIN remedies rem ON rem.id = rr.remedy_id
         JOIN rubrics r ON r.id = rr.rubric_id
         WHERE rem.name = ? AND r.section = ? AND r.rubric_text = ?`
      );
      const insLink = db.prepare(
        `INSERT INTO rubric_remedies (rubric_id, remedy_id, grade)
         SELECT r.id, rem.id, ? FROM rubrics r, remedies rem
         WHERE r.section = ? AND r.rubric_text = ? AND rem.name = ? COLLATE NOCASE`
      );
      for (const l of custom_remedy_links) {
        if (!l.remedy_name || !l.rubric_section || !l.rubric_text) continue;
        const existing = findLink.get(l.remedy_name, l.rubric_section, l.rubric_text);
        if (!existing) {
          const info = insLink.run(l.grade ?? 1, l.rubric_section, l.rubric_text, l.remedy_name);
          if (info.changes > 0) restoredLinks++;
        }
      }
    }

    db.exec('COMMIT');

    res.json({
      ok: true,
      message:
        `ব্যাকআপ রিস্টোর সম্পন্ন: ${patients.length} রোগী, ${cases.length} কেস, ${prescriptions.length} প্রেসক্রিপশন` +
        (restoredRemedies ? `, ${restoredRemedies} কাস্টম ওষুধ (${restoredLinks} রুব্রিক-লিংক)` : ''),
    });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'ব্যাকআপ রিস্টোর ব্যর্থ: ' + err.message });
  }
});

export default router;
