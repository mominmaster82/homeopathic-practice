// Firestore-ভিত্তিক ডেটা স্তর — ফাংশনগুলোর নাম ও রিটার্ন-আকৃতি পুরনো Express API-র হুবহু একই,
// তাই পেজগুলোর কোড বদলাতে হয় না। সব সর্টিং/ফিল্টার ক্লায়েন্ট-সাইডে (ছোট ডেটাসেট, কম্পোজিট ইনডেক্স লাগে না)।
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  runTransaction,
  writeBatch,
  getCountFromServer,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { db, auth } from '../firebase.js';

// ---------- সাধারণ হেল্পার ----------

const num = (v) => Number(v);

// SQLite-এর datetime('now')-এর মতো ফরম্যাট: "YYYY-MM-DD HH:MM:SS"
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// খালি/ফাঁকা মানকে null বানাই
const nullable = (v) => (v === undefined || v === null || v === '' ? null : v);
const nullableNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

// নতুন রেকর্ডের সংখ্যা-ID (counters/main ডকুমেন্টে ট্রানজ্যাকশনে বাড়ানো হয়)
async function nextId(field) {
  const ref = doc(db, 'counters', 'main');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.exists() ? snap.data()[field] || 0 : 0) + 1;
    tx.set(ref, { [field]: next }, { merge: true });
    return next;
  });
}

async function allDocs(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => d.data());
}

async function getOne(name, id) {
  const snap = await getDoc(doc(db, name, String(id)));
  return snap.exists() ? snap.data() : null;
}

// Firestore-এর `in` ফিল্টারে সর্বোচ্চ ৩০টি মান — তাই ভাগ করে কুয়েরি
function chunks(arr, size = 30) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// _docId সহ ফেরত দেয় (ডকুমেন্ট মুছতে/আপডেটে লাগে)
async function whereIn(name, field, values) {
  const out = [];
  for (const part of chunks(values)) {
    const snap = await getDocs(query(collection(db, name), where(field, 'in', part)));
    out.push(...snap.docs.map((d) => ({ _docId: d.id, ...d.data() })));
  }
  return out;
}

async function whereEq(name, field, value) {
  const snap = await getDocs(query(collection(db, name), where(field, '==', value)));
  return snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
}

async function deleteWhere(name, field, values) {
  const rows = values.length ? await whereIn(name, field, values) : [];
  const ops = rows.map((r) => (b) => b.delete(doc(db, name, r._docId)));
  await runOps(ops);
}

// ৫০০-অপশনের ব্যাচ-সীমা সামলে বাল্ক লেখা
async function runOps(ops) {
  if (!ops.length) return;
  let batch = writeBatch(db);
  let count = 0;
  for (const op of ops) {
    op(batch);
    if (++count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (count % 400 !== 0) await batch.commit();
}

// remedy_id তালিকা থেকে id→ওষুধ-ডকুমেন্ট ম্যাপ
async function remedyMap(ids) {
  const uniq = [...new Set(ids.map(num))];
  const docs = [];
  for (const part of chunks(uniq)) {
    const refs = part.map((id) => doc(db, 'remedies', String(id)));
    const snaps = await Promise.all(refs.map((r) => getDoc(r)));
    docs.push(...snaps.filter((s) => s.exists()).map((s) => s.data()));
  }
  return new Map(docs.map((d) => [d.id, d]));
}

const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));

// ---------- রোগী ----------

const patientsApi = {
  getPatients: async (q) => {
    let rows = await allDocs('patients');
    if (q && q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(s) || (p.phone || '').toLowerCase().includes(s)
      );
    }
    return rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  },

  getPatient: async (id) => {
    const row = await getOne('patients', id);
    if (!row) throw new Error('রোগী পাওয়া যায়নি');
    return row;
  },

  getPatientProfile: async (id) => {
    const patient = await getOne('patients', id);
    if (!patient) throw new Error('রোগী পাওয়া যায়নি');

    const cases = (await whereEq('cases', 'patient_id', num(id))).sort(byDateDesc);
    const rxs = cases.length
      ? await whereIn('prescriptions', 'case_id', cases.map((c) => c.id))
      : [];
    const rmap = await remedyMap(rxs.map((r) => r.remedy_id));

    const byCase = new Map();
    for (const rx of rxs.sort((a, b) => a.id - b.id)) {
      if (!byCase.has(rx.case_id)) byCase.set(rx.case_id, []);
      byCase.get(rx.case_id).push({
        id: rx.id,
        potency: rx.potency,
        dose: rx.dose,
        remedy_id: rx.remedy_id,
        remedy_name: rmap.get(num(rx.remedy_id))?.name || '?',
      });
    }

    return {
      ...patient,
      cases: cases.map((c) => ({ ...c, prescriptions: byCase.get(c.id) || [] })),
    };
  },

  addPatient: async (data) => {
    const { name, age, gender, phone } = data;
    if (!name) throw new Error('নাম আবশ্যক');
    const id = await nextId('patients');
    await setDoc(doc(db, 'patients', String(id)), {
      id,
      name,
      age: nullableNum(age),
      gender: nullable(gender),
      phone: nullable(phone),
      created_at: now(),
    });
    return { id };
  },

  updatePatient: async (id, data) => {
    const existing = await getOne('patients', id);
    if (!existing) throw new Error('রোগী পাওয়া যায়নি');
    if (data.name !== undefined && !String(data.name).trim()) {
      throw new Error('নাম খালি রাখা যাবে না');
    }
    const patch = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.age !== undefined) patch.age = nullableNum(data.age);
    if (data.gender !== undefined) patch.gender = nullable(data.gender);
    if (data.phone !== undefined) patch.phone = nullable(data.phone);
    await updateDoc(doc(db, 'patients', String(id)), patch);
    return { ok: true };
  },

  deletePatient: async (id) => {
    const existing = await getOne('patients', id);
    if (!existing) throw new Error('রোগী পাওয়া যায়নি');

    const cases = await whereEq('cases', 'patient_id', num(id));
    await deleteWhere('prescriptions', 'case_id', cases.map((c) => c.id));
    await runOps([
      ...cases.map((c) => (b) => b.delete(doc(db, 'cases', c._docId))),
      (b) => b.delete(doc(db, 'patients', String(id))),
    ]);
    return { ok: true };
  },
};

// ---------- ওষুধ ----------

const remediesApi = {
  getRemedies: async () => {
    const rows = await allDocs('remedies');
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  getRemedy: async (id) => {
    const row = await getOne('remedies', id);
    if (!row) throw new Error('ওষুধ পাওয়া যায়নি');
    return row;
  },

  getRemedyRubrics: async (id) => {
    const remedy = await getOne('remedies', id);
    if (!remedy) throw new Error('ওষুধ পাওয়া যায়নি');
    const links = await whereEq('rubric_links', 'remedy_id', num(id));

    const rubrics = [];
    for (const part of chunks(links.map((l) => num(l.rubric_id)))) {
      const refs = part.map((rid) => doc(db, 'rubrics', String(rid)));
      const snaps = await Promise.all(refs.map((r) => getDoc(r)));
      rubrics.push(...snaps.filter((s) => s.exists()).map((s) => s.data()));
    }
    const rmap = new Map(rubrics.map((r) => [r.id, r]));

    return links
      .map((l) => ({
        id: num(l.rubric_id),
        section: rmap.get(num(l.rubric_id))?.section || '',
        rubric_text: rmap.get(num(l.rubric_id))?.rubric_text || '',
        grade: l.grade,
      }))
      .sort(
        (a, b) =>
          b.grade - a.grade ||
          a.section.localeCompare(b.section) ||
          a.rubric_text.localeCompare(b.rubric_text)
      );
  },

  addRemedy: async (data) => {
    const name = (data.name || '').trim();
    if (!name) throw new Error('ওষুধের নাম দিতে হবে');
    const all = await allDocs('remedies');
    if (all.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('এই নামে ওষুধ আগে থেকেই আছে');
    }
    const id = await nextId('remedies');
    const row = {
      id,
      name,
      source: nullable(data.source),
      keynotes: nullable(data.keynotes),
      clinical: nullable(data.clinical),
      better: nullable(data.better),
      worse: nullable(data.worse),
      is_custom: 1,
    };
    await setDoc(doc(db, 'remedies', String(id)), row);
    return row;
  },

  updateRemedy: async (id, data) => {
    const existing = await getOne('remedies', id);
    if (!existing) throw new Error('ওষুধ পাওয়া যায়নি');
    const newName = data.name !== undefined ? String(data.name).trim() : existing.name;
    if (!newName) throw new Error('ওষুধের নাম খালি হতে পারে না');
    if (newName.toLowerCase() !== existing.name.toLowerCase()) {
      const all = await allDocs('remedies');
      if (all.some((r) => r.id !== num(id) && r.name.toLowerCase() === newName.toLowerCase())) {
        throw new Error('এই নামে আরেকটি ওষুধ আছে');
      }
    }
    const patch = { name: newName };
    for (const f of ['source', 'keynotes', 'clinical', 'better', 'worse']) {
      if (data[f] !== undefined) patch[f] = nullable(data[f]);
    }
    await updateDoc(doc(db, 'remedies', String(id)), patch);
    return { ok: true };
  },

  deleteRemedy: async (id) => {
    const existing = await getOne('remedies', id);
    if (!existing) throw new Error('ওষুধ পাওয়া যায়নি');
    if (!existing.is_custom) {
      throw new Error(
        'রেফারেন্স ডেটাসেটের ওষুধ মুছে ফেলা যাবে না — শুধু নিজের যোগ করা ওষুধ মুছতে পারবেন'
      );
    }
    const used = await whereEq('prescriptions', 'remedy_id', num(id));
    if (used.length > 0) {
      throw new Error('এই ওষুধটি প্রেসক্রিপশনে ব্যবহৃত হয়েছে, তাই মুছে ফেলা যাবে না');
    }
    await deleteWhere('rubric_links', 'remedy_id', [num(id)]);
    await deleteDoc(doc(db, 'remedies', String(id)));
    return { ok: true };
  },

  addRemedyRubric: async (id, rubricId, grade) => {
    const remedy = await getOne('remedies', id);
    if (!remedy) throw new Error('ওষুধ পাওয়া যায়নি');
    const rubric = await getOne('rubrics', rubricId);
    if (!rubric) throw new Error('রুব্রিক পাওয়া যায়নি');
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 1 || g > 3) throw new Error('গ্রেড ১, ২ বা ৩ হতে হবে');

    const links = await whereEq('rubric_links', 'remedy_id', num(id));
    const dup = links.find((l) => num(l.rubric_id) === num(rubricId));
    if (dup) {
      await updateDoc(doc(db, 'rubric_links', dup._docId), { grade: g });
    } else {
      await addDoc(collection(db, 'rubric_links'), {
        rubric_id: num(rubricId),
        remedy_id: num(id),
        grade: g,
      });
    }
    return { ok: true };
  },

  updateRemedyRubricGrade: async (id, rubricId, grade) => {
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 1 || g > 3) throw new Error('গ্রেড ১, ২ বা ৩ হতে হবে');
    const links = await whereEq('rubric_links', 'remedy_id', num(id));
    const link = links.find((l) => num(l.rubric_id) === num(rubricId));
    if (!link) throw new Error('লিংক পাওয়া যায়নি');
    await updateDoc(doc(db, 'rubric_links', link._docId), { grade: g });
    return { ok: true };
  },

  deleteRemedyRubric: async (id, rubricId) => {
    const links = await whereEq('rubric_links', 'remedy_id', num(id));
    const link = links.find((l) => num(l.rubric_id) === num(rubricId));
    if (!link) throw new Error('লিংক পাওয়া যায়নি');
    await deleteDoc(doc(db, 'rubric_links', link._docId));
    return { ok: true };
  },
};

// ---------- রুব্রিক ----------

const rubricsApi = {
  getRubrics: async (section) => {
    const rows = section ? await whereEq('rubrics', 'section', section) : await allDocs('rubrics');
    const clean = rows.map(({ _docId, ...r }) => r);
    return section
      ? clean.sort((a, b) => a.rubric_text.localeCompare(b.rubric_text))
      : clean.sort(
          (a, b) => a.section.localeCompare(b.section) || a.rubric_text.localeCompare(b.rubric_text)
        );
  },

  getSections: async () => {
    const rows = await allDocs('rubrics');
    return [...new Set(rows.map((r) => r.section))].sort((a, b) => a.localeCompare(b));
  },

  getRubricRemedies: async (id) => {
    const links = await whereEq('rubric_links', 'rubric_id', num(id));
    const rmap = await remedyMap(links.map((l) => l.remedy_id));
    return links
      .map((l) => ({
        id: num(l.remedy_id),
        name: rmap.get(num(l.remedy_id))?.name || '?',
        grade: l.grade,
      }))
      .sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name));
  },

  // নিজের রুব্রিক যোগ (is_custom চিহ্নিত — শুধু এগুলোই পরে মুছে ফেলা যাবে)
  addRubric: async (data) => {
    const section = (data.section || '').trim();
    const rubric_text = (data.rubric_text || '').trim();
    if (!section) throw new Error('শাখা (section) দিতে হবে');
    if (!rubric_text) throw new Error('রুব্রিকের টেক্সট দিতে হবে');
    const all = await allDocs('rubrics');
    if (
      all.some(
        (r) => r.section === section && r.rubric_text.toLowerCase() === rubric_text.toLowerCase()
      )
    ) {
      throw new Error('এই শাখায় একই রুব্রিক আগে থেকেই আছে');
    }
    const id = await nextId('rubrics');
    const row = { id, section, rubric_text, is_custom: 1 };
    await setDoc(doc(db, 'rubrics', String(id)), row);
    return row;
  },

  updateRubric: async (id, data) => {
    const existing = await getOne('rubrics', id);
    if (!existing) throw new Error('রুব্রিক পাওয়া যায়নি');
    const section = data.section !== undefined ? String(data.section).trim() : existing.section;
    const rubric_text =
      data.rubric_text !== undefined ? String(data.rubric_text).trim() : existing.rubric_text;
    if (!section) throw new Error('শাখা খালি হতে পারে না');
    if (!rubric_text) throw new Error('রুব্রিকের টেক্সট খালি হতে পারে না');
    const all = await allDocs('rubrics');
    if (
      all.some(
        (r) =>
          r.id !== num(id) &&
          r.section === section &&
          r.rubric_text.toLowerCase() === rubric_text.toLowerCase()
      )
    ) {
      throw new Error('এই শাখায় একই রুব্রিক আগে থেকেই আছে');
    }
    await updateDoc(doc(db, 'rubrics', String(id)), { section, rubric_text });
    return { ...existing, section, rubric_text };
  },

  deleteRubric: async (id) => {
    const existing = await getOne('rubrics', id);
    if (!existing) throw new Error('রুব্রিক পাওয়া যায়নি');
    if (!existing.is_custom) {
      throw new Error(
        'রেফারেন্স ডেটাসেটের রুব্রিক মুছে ফেলা যাবে না — শুধু নিজের যোগ করা রুব্রিক মুছতে পারবেন'
      );
    }
    await deleteWhere('rubric_links', 'rubric_id', [num(id)]);
    await deleteDoc(doc(db, 'rubrics', String(id)));
    return { ok: true };
  },

  // রুব্রিকে ওষুধ যুক্ত করা (ওষুধ-পক্ষের addRemedyRubric-এর মিরর)
  addRubricRemedy: async (rubricId, remedyId, grade) => {
    const rubric = await getOne('rubrics', rubricId);
    if (!rubric) throw new Error('রুব্রিক পাওয়া যায়নি');
    const remedy = await getOne('remedies', remedyId);
    if (!remedy) throw new Error('ওষুধ পাওয়া যায়নি');
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 1 || g > 3) throw new Error('গ্রেড ১, ২ বা ৩ হতে হবে');
    const links = await whereEq('rubric_links', 'rubric_id', num(rubricId));
    const dup = links.find((l) => num(l.remedy_id) === num(remedyId));
    if (dup) {
      await updateDoc(doc(db, 'rubric_links', dup._docId), { grade: g });
    } else {
      await addDoc(collection(db, 'rubric_links'), {
        rubric_id: num(rubricId),
        remedy_id: num(remedyId),
        grade: g,
      });
    }
    return { ok: true };
  },

  updateRubricRemedyGrade: async (rubricId, remedyId, grade) => {
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 1 || g > 3) throw new Error('গ্রেড ১, ২ বা ৩ হতে হবে');
    const links = await whereEq('rubric_links', 'rubric_id', num(rubricId));
    const link = links.find((l) => num(l.remedy_id) === num(remedyId));
    if (!link) throw new Error('লিংক পাওয়া যায়নি');
    await updateDoc(doc(db, 'rubric_links', link._docId), { grade: g });
    return { ok: true };
  },

  deleteRubricRemedy: async (rubricId, remedyId) => {
    const links = await whereEq('rubric_links', 'rubric_id', num(rubricId));
    const link = links.find((l) => num(l.remedy_id) === num(remedyId));
    if (!link) throw new Error('লিংক পাওয়া যায়নি');
    await deleteDoc(doc(db, 'rubric_links', link._docId));
    return { ok: true };
  },
};

// ---------- বিশ্লেষণ (রেপার্টরাইজেশন — ক্লায়েন্ট-সাইডে গ্রেড যোগফল) ----------

async function analyze(rubricIds) {
  if (!Array.isArray(rubricIds) || rubricIds.length === 0) {
    throw new Error('কমপক্ষে একটি রুব্রিক নির্বাচন করুন');
  }
  const wanted = new Set(rubricIds.map(num));
  const allLinks = await allDocs('rubric_links');

  const scores = new Map(); // remedy_id -> { remedy_id, total, hits }
  for (const l of allLinks) {
    if (!wanted.has(num(l.rubric_id))) continue;
    const rid = num(l.remedy_id);
    const entry = scores.get(rid) || { remedy_id: rid, total: 0, hits: 0 };
    entry.total += l.grade;
    entry.hits += 1;
    scores.set(rid, entry);
  }

  const rmap = await remedyMap([...scores.keys()]);
  return [...scores.values()]
    .map((e) => {
      const r = rmap.get(e.remedy_id) || {};
      return {
        remedy_id: e.remedy_id,
        name: r.name,
        source: r.source,
        keynotes: r.keynotes,
        total: e.total,
        hits: e.hits,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// ---------- কেস ও প্রেসক্রিপশন ----------

const casesApi = {
  getCases: async (patientId) => {
    if (!patientId) throw new Error('patient_id আবশ্যক');
    const rows = await whereEq('cases', 'patient_id', num(patientId));
    return rows.map(({ _docId, ...c }) => c).sort(byDateDesc);
  },

  getRecentCases: async (limit = 5) => {
    const countSnap = await getCountFromServer(collection(db, 'cases'));
    const total = countSnap.data().count;

    const all = (await allDocs('cases')).sort(byDateDesc);
    const recent = all.slice(0, limit);
    const patients = await allDocs('patients');
    const pmap = new Map(patients.map((p) => [p.id, p.name]));

    return {
      total,
      recent: recent.map((c) => ({
        id: c.id,
        date: c.date,
        symptoms: c.symptoms,
        patient_id: c.patient_id,
        patient_name: pmap.get(num(c.patient_id)) || '?',
      })),
    };
  },

  getCase: async (id) => {
    const caseRow = await getOne('cases', id);
    if (!caseRow) throw new Error('কেস পাওয়া যায়নি');
    const rxs = (await whereEq('prescriptions', 'case_id', num(id))).sort((a, b) => a.id - b.id);
    const rmap = await remedyMap(rxs.map((r) => r.remedy_id));
    return {
      ...caseRow,
      prescriptions: rxs.map((r) => ({
        id: r.id,
        potency: r.potency,
        dose: r.dose,
        remedy_id: num(r.remedy_id),
        remedy_name: rmap.get(num(r.remedy_id))?.name || '?',
      })),
    };
  },

  addCase: async (data) => {
    const {
      patient_id, symptoms, notes,
      duration, cause, aggravation, amelioration, past_medication,
    } = data;
    if (!patient_id) throw new Error('রোগী নির্বাচন করুন');
    const patient = await getOne('patients', patient_id);
    if (!patient) throw new Error('রোগী পাওয়া যায়নি');
    const id = await nextId('cases');
    await setDoc(doc(db, 'cases', String(id)), {
      id,
      patient_id: num(patient_id),
      symptoms: nullable(symptoms),
      notes: nullable(notes),
      duration: nullable(duration),
      cause: nullable(cause),
      aggravation: nullable(aggravation),
      amelioration: nullable(amelioration),
      past_medication: nullable(past_medication),
      date: now(),
    });
    return { id };
  },

  updateCase: async (id, data) => {
    const existing = await getOne('cases', id);
    if (!existing) throw new Error('কেস পাওয়া যায়নি');
    const patch = {};
    if (data.symptoms !== undefined) patch.symptoms = nullable(data.symptoms) ?? existing.symptoms;
    if (data.notes !== undefined) patch.notes = nullable(data.notes) ?? existing.notes;
    for (const f of ['duration', 'cause', 'aggravation', 'amelioration', 'past_medication']) {
      if (data[f] !== undefined) patch[f] = nullable(data[f]) ?? existing[f];
    }
    await updateDoc(doc(db, 'cases', String(id)), patch);
    return { ok: true };
  },

  deleteCase: async (id) => {
    const existing = await getOne('cases', id);
    if (!existing) throw new Error('কেস পাওয়া যায়নি');
    await deleteWhere('prescriptions', 'case_id', [num(id)]);
    await deleteDoc(doc(db, 'cases', String(id)));
    return { ok: true };
  },

  addPrescription: async (caseId, data) => {
    const { remedy_id, potency, dose } = data;
    const caseRow = await getOne('cases', caseId);
    if (!caseRow) throw new Error('কেস পাওয়া যায়নি');
    if (!remedy_id) throw new Error('ওষুধ নির্বাচন করুন');
    const remedy = await getOne('remedies', remedy_id);
    if (!remedy) throw new Error('ওষুধ পাওয়া যায়নি');
    const id = await nextId('prescriptions');
    await setDoc(doc(db, 'prescriptions', String(id)), {
      id,
      case_id: num(caseId),
      remedy_id: num(remedy_id),
      potency: nullable(potency),
      dose: nullable(dose),
    });
    return { id };
  },

  updatePrescription: async (caseId, prescriptionId, data) => {
    const existing = await getOne('prescriptions', prescriptionId);
    if (!existing || num(existing.case_id) !== num(caseId)) {
      throw new Error('প্রেসক্রিপশন পাওয়া যায়নি');
    }
    const patch = {};
    if (data.remedy_id !== undefined && data.remedy_id !== null) {
      const remedy = await getOne('remedies', data.remedy_id);
      if (!remedy) throw new Error('ওষুধ পাওয়া যায়নি');
      patch.remedy_id = num(data.remedy_id);
    }
    if (data.potency !== undefined) patch.potency = nullable(data.potency) ?? existing.potency;
    if (data.dose !== undefined) patch.dose = nullable(data.dose) ?? existing.dose;
    await updateDoc(doc(db, 'prescriptions', String(prescriptionId)), patch);
    return { ok: true };
  },

  deletePrescription: async (caseId, prescriptionId) => {
    const existing = await getOne('prescriptions', prescriptionId);
    if (!existing || num(existing.case_id) !== num(caseId)) {
      throw new Error('প্রেসক্রিপশন পাওয়া যায়নি');
    }
    await deleteDoc(doc(db, 'prescriptions', String(prescriptionId)));
    return { ok: true };
  },
};

// ---------- সেটিংস (ক্লিনিকের পরিচয়) ----------

const ALLOWED_KEYS = [
  'clinic_name',
  'doctor_name',
  'address',
  'phone',
  'email',
  'footer_note',
  'logo',
];

const settingsApi = {
  getSettings: async () => {
    const snap = await getDoc(doc(db, 'settings', 'clinic'));
    return snap.exists() ? snap.data() : {};
  },

  updateSettings: async (data) => {
    const patch = {};
    for (const k of ALLOWED_KEYS) {
      if (k in data) patch[k] = data[k] == null ? '' : String(data[k]);
    }
    await setDoc(doc(db, 'settings', 'clinic'), patch, { merge: true });
    return settingsApi.getSettings();
  },
};

// ---------- ব্যাকআপ (version 2 ফরম্যাট — SQLite ভার্সনের সাথে সামঞ্জস্যপূর্ণ) ----------

const backupApi = {
  exportBackup: async () => {
    const [patients, cases, prescriptions, remedies, rubrics, links, settings] = await Promise.all([
      allDocs('patients'),
      allDocs('cases'),
      allDocs('prescriptions'),
      allDocs('remedies'),
      allDocs('rubrics'),
      allDocs('rubric_links'),
      settingsApi.getSettings(),
    ]);

    const custom = remedies.filter((r) => r.is_custom === 1);
    const customIds = new Set(custom.map((r) => r.id));
    const rmap = new Map(remedies.map((r) => [r.id, r.name]));
    const rubMap = new Map(rubrics.map((r) => [r.id, r]));

    const customRubrics = rubrics.filter((r) => r.is_custom === 1);
    const customRubricIds = new Set(customRubrics.map((r) => r.id));

    return {
      version: 2,
      exported_at: new Date().toISOString(),
      data: {
        patients,
        cases,
        prescriptions,
        settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
        custom_remedies: custom.map((r) => ({
          name: r.name,
          source: r.source,
          keynotes: r.keynotes,
          clinical: r.clinical,
          better: r.better,
          worse: r.worse,
        })),
        custom_remedy_links: links
          .filter((l) => customIds.has(num(l.remedy_id)))
          .map((l) => ({
            remedy_name: rmap.get(num(l.remedy_id)),
            rubric_section: rubMap.get(num(l.rubric_id))?.section,
            rubric_text: rubMap.get(num(l.rubric_id))?.rubric_text,
            grade: l.grade,
          })),
        custom_rubrics: customRubrics.map((r) => ({
          section: r.section,
          rubric_text: r.rubric_text,
        })),
        custom_rubric_links: links
          .filter((l) => customRubricIds.has(num(l.rubric_id)))
          .map((l) => ({
            remedy_name: rmap.get(num(l.remedy_id)),
            rubric_section: rubMap.get(num(l.rubric_id))?.section,
            rubric_text: rubMap.get(num(l.rubric_id))?.rubric_text,
            grade: l.grade,
          })),
      },
    };
  },

  importBackup: async (backup) => {
    if (!backup || !backup.data) throw new Error('অবৈধ ব্যাকআপ ফরম্যাট');
    const { patients, cases, prescriptions, settings } = backup.data;
    if (!Array.isArray(patients) || !Array.isArray(cases) || !Array.isArray(prescriptions)) {
      throw new Error('ব্যাকআপ ডেটা অসম্পূর্ণ');
    }

    // পুরনো ডেটা মুছি
    const delOps = [];
    for (const col of ['patients', 'cases', 'prescriptions']) {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        const ref = doc(db, col, d.id);
        delOps.push((b) => b.delete(ref));
      }
    }
    await runOps(delOps);

    // নতুন ডেটা ঢোকাই (আগের ID সহ)
    const insOps = [];
    for (const p of patients) insOps.push((b) => b.set(doc(db, 'patients', String(p.id)), p));
    for (const c of cases) insOps.push((b) => b.set(doc(db, 'cases', String(c.id)), c));
    for (const rx of prescriptions) {
      insOps.push((b) => b.set(doc(db, 'prescriptions', String(rx.id)), rx));
    }
    const settingsObj = {};
    for (const s of Array.isArray(settings) ? settings : []) {
      if (s.key && s.key !== 'admin_password_hash') settingsObj[s.key] = s.value;
    }
    insOps.push((b) => b.set(doc(db, 'settings', 'clinic'), settingsObj, { merge: false }));
    await runOps(insOps);

    // counters ঠিক রাখি (ইমপোর্টেড সর্বোচ্চ ID-র নিচে যেন না থাকে)
    const maxOf = (rows) => rows.reduce((m, r) => Math.max(m, num(r.id) || 0), 0);
    const countersRef = doc(db, 'counters', 'main');
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(countersRef);
      const cur = snap.exists() ? snap.data() : {};
      const patch = {};
      for (const [field, rows] of [
        ['patients', patients],
        ['cases', cases],
        ['prescriptions', prescriptions],
      ]) {
        patch[field] = Math.max(cur[field] || 0, maxOf(rows));
      }
      tx.set(countersRef, patch, { merge: true });
    });

    // কাস্টম ওষুধ upsert (নাম অনুযায়ী, ছোট-বড় অক্ষর উপেক্ষা)
    const customRemedies = Array.isArray(backup.data.custom_remedies)
      ? backup.data.custom_remedies
      : [];
    const customLinks = Array.isArray(backup.data.custom_remedy_links)
      ? backup.data.custom_remedy_links
      : [];
    const allRemedies = await allDocs('remedies');
    const byLower = new Map(allRemedies.map((r) => [r.name.toLowerCase(), r]));

    let restoredRemedies = 0;
    for (const cr of customRemedies) {
      if (!cr.name) continue;
      const fields = {
        name: cr.name,
        source: cr.source ?? null,
        keynotes: cr.keynotes ?? null,
        clinical: cr.clinical ?? null,
        better: cr.better ?? null,
        worse: cr.worse ?? null,
        is_custom: 1,
      };
      const existingR = byLower.get(cr.name.toLowerCase());
      if (existingR) {
        await updateDoc(doc(db, 'remedies', String(existingR.id)), fields);
        byLower.set(cr.name.toLowerCase(), { ...existingR, ...fields });
      } else {
        const id = await nextId('remedies');
        await setDoc(doc(db, 'remedies', String(id)), { id, ...fields });
        byLower.set(cr.name.toLowerCase(), { id, ...fields });
      }
      restoredRemedies++;
    }

    // কাস্টম রুব্রিক upsert (ন্যাচারাল কী: section|||rubric_text)
    const customRubrics = Array.isArray(backup.data.custom_rubrics) ? backup.data.custom_rubrics : [];
    const customRubricLinks = Array.isArray(backup.data.custom_rubric_links)
      ? backup.data.custom_rubric_links
      : [];
    const existingRubrics = await allDocs('rubrics');
    const rubByKey = new Map(
      existingRubrics.map((r) => [`${r.section}|||${r.rubric_text}`, r])
    );
    let restoredRubrics = 0;
    for (const cr of customRubrics) {
      if (!cr.section || !cr.rubric_text) continue;
      const key = `${cr.section}|||${cr.rubric_text}`;
      if (!rubByKey.has(key)) {
        const id = await nextId('rubrics');
        const row = { id, section: cr.section, rubric_text: cr.rubric_text, is_custom: 1 };
        await setDoc(doc(db, 'rubrics', String(id)), row);
        rubByKey.set(key, row);
      }
      restoredRubrics++;
    }

    // কাস্টম লিংক (ন্যাচারাল কী দিয়ে মেলাও, ডুপ্লিকেট এড়িয়ে)
    const restoreLink = async (cl) => {
      const remedy = byLower.get(String(cl.remedy_name || '').toLowerCase());
      const rubric = rubByKey.get(`${cl.rubric_section}|||${cl.rubric_text}`);
      if (!remedy || !rubric) return false;
      const links = await whereEq('rubric_links', 'remedy_id', remedy.id);
      const dup = links.find((l) => num(l.rubric_id) === rubric.id);
      if (dup) {
        await updateDoc(doc(db, 'rubric_links', dup._docId), { grade: cl.grade });
      } else {
        await addDoc(collection(db, 'rubric_links'), {
          rubric_id: rubric.id,
          remedy_id: remedy.id,
          grade: cl.grade,
        });
      }
      return true;
    };

    const seenLinks = new Set();
    let restoredLinks = 0;
    for (const cl of [...customLinks, ...customRubricLinks]) {
      const k = `${String(cl.remedy_name || '').toLowerCase()}|||${cl.rubric_section}|||${cl.rubric_text}`;
      if (seenLinks.has(k)) continue;
      seenLinks.add(k);
      if (await restoreLink(cl)) restoredLinks++;
    }

    return {
      ok: true,
      message: `ব্যাকআপ রিস্টোর সম্পন্ন: ${patients.length} রোগী, ${cases.length} কেস, ${prescriptions.length} প্রেসক্রিপশন, ${restoredRemedies} কাস্টম ওষুধ, ${restoredRubrics} কাস্টম রুব্রিক (${restoredLinks} লিংক)`,
    };
  },
};

// ---------- auth (Firebase Authentication) ----------

function authError(err) {
  const code = err?.code || '';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return new Error('ইমেইল বা পাসওয়ার্ড ভুল');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('অনেকবার ব্যর্থ চেষ্টা — কিছুক্ষণ পরে আবার চেষ্টা করুন');
  }
  return err;
}

const authApi = {
  login: async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    } catch (err) {
      throw authError(err);
    }
  },

  logout: () => signOut(auth),

  subscribeAuth: (cb) => onAuthStateChanged(auth, cb),

  changePassword: async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    if (!user) throw new Error('আগে লগইন করুন');
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      return { message: 'পাসওয়ার্ড পরিবর্তিত হয়েছে' };
    } catch (err) {
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        throw new Error('বর্তমান পাসওয়ার্ড ভুল');
      }
      if (err?.code === 'auth/weak-password') {
        throw new Error('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      }
      throw err;
    }
  },
};

// ---------- একত্রে ----------

export const api = {
  ...patientsApi,
  ...remediesApi,
  ...rubricsApi,
  analyze,
  ...casesApi,
  ...settingsApi,
  ...backupApi,
  ...authApi,
};
