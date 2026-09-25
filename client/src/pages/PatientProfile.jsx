import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { extraCaseFields } from './caseFields.js';

const potencies = ['6C', '30C', '200C', '1M', '0/1 (LM)', 'Q (মাতৃটিংচার)'];
const input = 'input';
const emptyCase = {
  symptoms: '', notes: '',
  duration: '', cause: '', aggravation: '', amelioration: '', past_medication: '',
};
const emptyRx = { remedy_id: '', potency: '30C', dose: '' };

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState('');        // ফ্যাটাল লোড-এরর (এরর স্ক্রিন দেখায়)
  const [notice, setNotice] = useState('');   // নন-ফ্যাটাল সফলতা/এরর বার্তা
  const [remedies, setRemedies] = useState([]);

  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseForm, setCaseForm] = useState(emptyCase);
  const [rxForCase, setRxForCase] = useState(null);
  const [rxForm, setRxForm] = useState(emptyRx);
  const [busy, setBusy] = useState(false);

  // সম্পাদনা অবস্থা
  const [editCaseId, setEditCaseId] = useState(null);
  const [editCaseForm, setEditCaseForm] = useState(emptyCase);
  const [editRx, setEditRx] = useState(null);        // { caseId, rxId }
  const [editRxForm, setEditRxForm] = useState(emptyRx);

  const load = useCallback(
    () => api.getPatientProfile(id).then(setP).catch((e) => setMsg(e.message)),
    [id]
  );
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getRemedies().then(setRemedies).catch(() => {}); }, []);

  if (msg) {
    return (
      <div className="space-y-4">
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{msg}</div>
        <Link to="/patients" className="text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline">← রোগী তালিকায় ফিরে যান</Link>
      </div>
    );
  }

  if (!p) return <div className="py-8 text-center text-sm text-slate-400">লোড হচ্ছে…</div>;

  const caseCount = p.cases.length;
  const rxCount = p.cases.reduce((n, c) => n + c.prescriptions.length, 0);

  const onDelete = async () => {
    if (!confirm(`"${p.name}" কে মুছে ফেলবেন? সংশ্লিষ্ট সব কেসও মুছে যাবে।`)) return;
    try {
      await api.deletePatient(p.id);
      navigate('/patients');
    } catch (e) {
      setMsg(e.message);
    }
  };

  // ---- নতুন কেস ----
  const toggleCaseForm = () => {
    setShowCaseForm((v) => !v);
    setCaseForm(emptyCase);
    setNotice('');
  };

  const submitCase = async (e) => {
    e.preventDefault();
    if (!caseForm.symptoms.trim()) { setNotice('লক্ষণ লিখুন'); return; }
    setBusy(true);
    try {
      await api.addCase({ patient_id: Number(id), ...caseForm });
      setCaseForm(emptyCase);
      setShowCaseForm(false);
      await load();
      setNotice('নতুন কেস যোগ হয়েছে');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- কেস সম্পাদনা / মুছে ফেলা ----
  const startEditCase = (c) => {
    setEditCaseId(c.id);
    setEditCaseForm({
      symptoms: c.symptoms || '',
      notes: c.notes || '',
      duration: c.duration || '',
      cause: c.cause || '',
      aggravation: c.aggravation || '',
      amelioration: c.amelioration || '',
      past_medication: c.past_medication || '',
    });
    setNotice('');
  };

  const cancelEditCase = () => { setEditCaseId(null); setEditCaseForm(emptyCase); };

  const submitEditCase = async (e, caseId) => {
    e.preventDefault();
    if (!editCaseForm.symptoms.trim()) { setNotice('লক্ষণ লিখুন'); return; }
    setBusy(true);
    try {
      await api.updateCase(caseId, editCaseForm);
      cancelEditCase();
      await load();
      setNotice('কেস হালনাগাদ হয়েছে');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDeleteCase = async (c) => {
    if (!confirm(`কেস #${c.id} মুছে ফেলবেন? এর সব প্রেসক্রিপশনও মুছে যাবে।`)) return;
    setBusy(true);
    try {
      await api.deleteCase(c.id);
      if (editCaseId === c.id) cancelEditCase();
      if (editRx?.caseId === c.id) setEditRx(null);
      await load();
      setNotice('কেস মুছে ফেলা হয়েছে');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- প্রেসক্রিপশন যোগ ----
  const toggleRx = (caseId) => {
    setRxForCase((cur) => (cur === caseId ? null : caseId));
    setRxForm(emptyRx);
    setNotice('');
  };

  const submitRx = async (e, caseId) => {
    e.preventDefault();
    if (!rxForm.remedy_id) { setNotice('একটি ওষুধ বেছে নিন'); return; }
    setBusy(true);
    try {
      await api.addPrescription(caseId, {
        remedy_id: Number(rxForm.remedy_id),
        potency: rxForm.potency,
        dose: rxForm.dose,
      });
      setRxForm(emptyRx);
      setRxForCase(null);
      await load();
      setNotice('প্রেসক্রিপশন যোগ হয়েছে');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- প্রেসক্রিপশন সম্পাদনা / মুছে ফেলা ----
  const startEditRx = (caseId, rx) => {
    setEditRx({ caseId, rxId: rx.id });
    setEditRxForm({
      remedy_id: String(rx.remedy_id ?? ''),
      potency: rx.potency || '30C',
      dose: rx.dose || '',
    });
    setNotice('');
  };

  const cancelEditRx = () => { setEditRx(null); setEditRxForm(emptyRx); };

  const submitEditRx = async (e) => {
    e.preventDefault();
    if (!editRxForm.remedy_id) { setNotice('একটি ওষুধ বেছে নিন'); return; }
    setBusy(true);
    try {
      await api.updatePrescription(editRx.caseId, editRx.rxId, {
        remedy_id: Number(editRxForm.remedy_id),
        potency: editRxForm.potency,
        dose: editRxForm.dose,
      });
      cancelEditRx();
      await load();
      setNotice('প্রেসক্রিপশন হালনাগাদ হয়েছে');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDeleteRx = async (caseId, rx) => {
    if (!confirm(`"${rx.remedy_name}" প্রেসক্রিপশনটি মুছে ফেলবেন?`)) return;
    setBusy(true);
    try {
      await api.deletePrescription(caseId, rx.id);
      if (editRx?.rxId === rx.id) cancelEditRx();
      await load();
      setNotice('প্রেসক্রিপশন মুছে ফেলা হয়েছে');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* শিরোনাম + কাজ */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-xl font-bold text-white shadow-soft">
              {p.name?.trim()?.charAt(0) || '—'}
            </div>
            <div>
              <Link to="/patients" className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline">← রোগী তালিকা</Link>
              <h2 className="page-title mt-0.5">{p.name}</h2>
              <p className="page-sub mt-0.5">
                {[p.age ? `বয়স: ${p.age}` : null, p.gender ? `লিঙ্গ: ${p.gender}` : null, p.phone ? `ফোন: ${p.phone}` : null]
                  .filter(Boolean).join(' · ') || 'কোনো অতিরিক্ত তথ্য নেই'}
              </p>
              <p className="mt-1 text-xs text-slate-400">যোগ হয়েছে: {p.created_at}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleCaseForm}
              className={showCaseForm ? 'btn btn-ghost' : 'btn btn-primary'}
            >
              {showCaseForm ? 'কেস ফর্ম বন্ধ করুন' : '+ নতুন কেস'}
            </button>
            <button
              onClick={() => navigate('/patients')}
              className="btn btn-ghost"
            >
              সম্পাদনা
            </button>
            <button
              onClick={onDelete}
              className="btn btn-danger"
            >
              মুছুন
            </button>
          </div>
        </div>
      </div>

      {/* নন-ফ্যাটাল বার্তা */}
      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-800 shadow-soft">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="rounded-full p-0.5 text-teal-500 hover:bg-teal-100 hover:text-teal-800">✕</button>
        </div>
      )}

      {/* ইনলাইন নতুন কেস ফর্ম */}
      {showCaseForm && (
        <form onSubmit={submitCase} className="card space-y-3 border-amber-200 p-5">
          <div className="section-title">নতুন কেস</div>
          <textarea
            className={input}
            name="symptoms"
            placeholder="লক্ষণ * (কমা দিয়ে আলাদা করুন)"
            rows="2"
            value={caseForm.symptoms}
            onChange={(e) => setCaseForm({ ...caseForm, symptoms: e.target.value })}
          />
          {extraCaseFields.map((f) => (
            f.type === 'input' ? (
              <input
                key={f.name}
                className={input}
                type="text"
                name={f.name}
                placeholder={f.placeholder}
                value={caseForm[f.name]}
                onChange={(e) => setCaseForm({ ...caseForm, [f.name]: e.target.value })}
              />
            ) : (
              <textarea
                key={f.name}
                className={input}
                name={f.name}
                rows="2"
                placeholder={f.placeholder}
                value={caseForm[f.name]}
                onChange={(e) => setCaseForm({ ...caseForm, [f.name]: e.target.value })}
              />
            )
          ))}
          <textarea
            className={input}
            name="notes"
            placeholder="নোট / পর্যবেক্ষণ"
            rows="2"
            value={caseForm.notes}
            onChange={(e) => setCaseForm({ ...caseForm, notes: e.target.value })}
          />
          <div className="flex gap-2 pt-1">
            <button
              disabled={busy}
              className="btn btn-primary"
            >
              {busy ? 'সংরক্ষণ হচ্ছে…' : 'কেস সংরক্ষণ করো'}
            </button>
            <button
              type="button"
              onClick={toggleCaseForm}
              className="btn btn-ghost"
            >
              বাতিল
            </button>
          </div>
        </form>
      )}

      {/* পরিসংখ্যান */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-5 transition hover:shadow-card">
          <div className="text-3xl font-bold tracking-tight text-teal-700">{caseCount}</div>
          <div className="mt-1 text-sm text-slate-500">কেস</div>
        </div>
        <div className="card p-5 transition hover:shadow-card">
          <div className="text-3xl font-bold tracking-tight text-amber-600">{rxCount}</div>
          <div className="mt-1 text-sm text-slate-500">প্রেসক্রিপশন</div>
        </div>
        <div className="card col-span-2 p-5 transition hover:shadow-card sm:col-span-1">
          <div className="text-sm text-slate-500">সর্বশেষ সাক্ষাৎ</div>
          <div className="mt-1 text-lg font-semibold text-slate-800">
            {caseCount ? p.cases[0].date : '—'}
          </div>
        </div>
      </div>

      {/* টাইমলাইন */}
      <div>
        <h3 className="section-title mb-3">কেস টাইমলাইন</h3>

        {caseCount === 0 && (
          <div className="card py-8 text-center text-sm text-slate-400">
            এই রোগীর এখনো কোনো কেস নেই।
          </div>
        )}

        {caseCount > 0 && (
          <ol className="relative ml-2 space-y-5 border-l-2 border-teal-200">
            {p.cases.map((c) => (
              <li key={c.id} className="ml-5">
                <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-teal-500 shadow-soft" />
                <div className="card space-y-4 p-5 transition hover:shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">কেস #{c.id}</span>
                      {editCaseId === c.id && (
                        <span className="badge border-amber-200 bg-amber-50 text-amber-700">✎</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{c.date}</span>
                      <Link to={`/print/${c.id}`} className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline">
                        🖨 প্রিন্ট / PDF
                      </Link>
                      <button
                        onClick={() => (editCaseId === c.id ? cancelEditCase() : startEditCase(c))}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline"
                      >
                        {editCaseId === c.id ? 'বাতিল' : 'সম্পাদনা'}
                      </button>
                      <button
                        onClick={() => onDeleteCase(c)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                      >
                        মুছুন
                      </button>
                    </div>
                  </div>

                  {editCaseId === c.id ? (
                    <form onSubmit={(e) => submitEditCase(e, c.id)} className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <textarea
                        className={input}
                        placeholder="লক্ষণ *"
                        rows="2"
                        value={editCaseForm.symptoms}
                        onChange={(e) => setEditCaseForm({ ...editCaseForm, symptoms: e.target.value })}
                      />
                      {extraCaseFields.map((f) => (
                        f.type === 'input' ? (
                          <input
                            key={f.name}
                            className={input}
                            type="text"
                            placeholder={f.placeholder}
                            value={editCaseForm[f.name]}
                            onChange={(e) => setEditCaseForm({ ...editCaseForm, [f.name]: e.target.value })}
                          />
                        ) : (
                          <textarea
                            key={f.name}
                            className={input}
                            rows="2"
                            placeholder={f.placeholder}
                            value={editCaseForm[f.name]}
                            onChange={(e) => setEditCaseForm({ ...editCaseForm, [f.name]: e.target.value })}
                          />
                        )
                      ))}
                      <textarea
                        className={input}
                        placeholder="নোট / পর্যবেক্ষণ"
                        rows="2"
                        value={editCaseForm.notes}
                        onChange={(e) => setEditCaseForm({ ...editCaseForm, notes: e.target.value })}
                      />
                      <button
                        disabled={busy}
                        className="btn btn-primary btn-sm"
                      >
                        {busy ? 'সংরক্ষণ হচ্ছে…' : 'হালনাগাদ করো'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                      {c.symptoms && <div className="text-sm text-slate-700"><b className="font-semibold text-slate-800">লক্ষণ:</b> {c.symptoms}</div>}
                      {extraCaseFields.map((f) => c[f.name] && (
                        <div key={f.name} className="text-sm text-slate-700"><b className="font-semibold text-slate-800">{f.label}:</b> {c[f.name]}</div>
                      ))}
                      {c.notes && <div className="text-sm text-slate-700"><b className="font-semibold text-slate-800">নোট:</b> {c.notes}</div>}
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="section-title">প্রেসক্রিপশন</div>
                      <button
                        onClick={() => toggleRx(c.id)}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline"
                      >
                        {rxForCase === c.id ? 'বাতিল' : '+ প্রেসক্রিপশন'}
                      </button>
                    </div>

                    {c.prescriptions.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">কোনো ওষুধ যোগ করা হয়নি।</div>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {c.prescriptions.map((rx) => (
                          <li
                            key={rx.id}
                            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm shadow-soft transition hover:border-amber-300"
                          >
                            <span>
                              <b className="font-semibold text-amber-800">{rx.remedy_name}</b>
                              {rx.potency && <span className="text-slate-500"> · {rx.potency}</span>}
                              {rx.dose && <span className="text-slate-500"> · {rx.dose}</span>}
                            </span>
                            <button
                              onClick={() => startEditRx(c.id, rx)}
                              title="সম্পাদনা"
                              className="rounded p-0.5 text-amber-600 hover:bg-amber-100 hover:text-amber-800"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => onDeleteRx(c.id, rx)}
                              title="মুছুন"
                              className="rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {rxForCase === c.id && (
                      <form
                        onSubmit={(e) => submitRx(e, c.id)}
                        className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <select
                            className={input}
                            value={rxForm.remedy_id}
                            onChange={(e) => setRxForm({ ...rxForm, remedy_id: e.target.value })}
                          >
                            <option value="">— ওষুধ বেছে নিন —</option>
                            {remedies.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <select
                            className={input}
                            value={rxForm.potency}
                            onChange={(e) => setRxForm({ ...rxForm, potency: e.target.value })}
                          >
                            {potencies.map((pt) => (
                              <option key={pt} value={pt}>{pt}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          className={input}
                          rows="2"
                          placeholder="সেবনবিধি বিস্তারিত লিখুন যাতে সাধারণ মানুষও বোঝে — যেমন: সকালে ও রাতে খালি পেটে ২টি করে পিল, ৭ দিন খাবেন"
                          value={rxForm.dose}
                          onChange={(e) => setRxForm({ ...rxForm, dose: e.target.value })}
                        />
                        <button
                          disabled={busy}
                          className="btn bg-amber-600 text-white shadow-soft hover:bg-amber-700"
                        >
                          {busy ? 'যোগ হচ্ছে…' : 'ওষুধ যোগ করো'}
                        </button>
                      </form>
                    )}

                    {editRx?.caseId === c.id && (
                      <form
                        onSubmit={submitEditRx}
                        className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
                      >
                        <div className="text-xs font-medium text-slate-500">প্রেসক্রিপশন সম্পাদনা</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <select
                            className={input}
                            value={editRxForm.remedy_id}
                            onChange={(e) => setEditRxForm({ ...editRxForm, remedy_id: e.target.value })}
                          >
                            <option value="">— ওষুধ বেছে নিন —</option>
                            {remedies.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <select
                            className={input}
                            value={editRxForm.potency}
                            onChange={(e) => setEditRxForm({ ...editRxForm, potency: e.target.value })}
                          >
                            {potencies.map((pt) => (
                              <option key={pt} value={pt}>{pt}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          className={input}
                          rows="2"
                          placeholder="সেবনবিধি বিস্তারিত লিখুন যাতে সাধারণ মানুষও বোঝে — যেমন: সকালে ও রাতে খালি পেটে ২টি করে পিল, ৭ দিন খাবেন"
                          value={editRxForm.dose}
                          onChange={(e) => setEditRxForm({ ...editRxForm, dose: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={busy}
                            className="btn btn-primary btn-sm"
                          >
                            {busy ? 'সংরক্ষণ হচ্ছে…' : 'হালনাগাদ করো'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditRx}
                            className="btn btn-ghost btn-sm"
                          >
                            বাতিল
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
