import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';

const potencies = ['6C', '30C', '200C', '1M', '0/1 (LM)', 'Q (মাতৃটিংচার)'];
const input = 'border rounded-md px-3 py-2 w-full';
const emptyCase = { symptoms: '', notes: '' };
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
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{msg}</div>
        <Link to="/patients" className="text-teal-700 hover:underline text-sm">← রোগী তালিকায় ফিরে যান</Link>
      </div>
    );
  }

  if (!p) return <div className="text-sm text-gray-400">লোড হচ্ছে…</div>;

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
    setEditCaseForm({ symptoms: c.symptoms || '', notes: c.notes || '' });
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/patients" className="text-sm text-teal-700 hover:underline">← রোগী তালিকা</Link>
          <h2 className="text-2xl font-bold text-gray-800">{p.name}</h2>
          <p className="text-sm text-gray-500">
            {[p.age ? `বয়স: ${p.age}` : null, p.gender ? `লিঙ্গ: ${p.gender}` : null, p.phone ? `ফোন: ${p.phone}` : null]
              .filter(Boolean).join(' · ') || 'কোনো অতিরিক্ত তথ্য নেই'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">যোগ হয়েছে: {p.created_at}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleCaseForm}
            className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700"
          >
            {showCaseForm ? 'কেস ফর্ম বন্ধ করুন' : '+ নতুন কেস'}
          </button>
          <button
            onClick={() => navigate('/patients')}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
          >
            সম্পাদনা
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
          >
            মুছুন
          </button>
        </div>
      </div>

      {/* নন-ফ্যাটাল বার্তা */}
      {notice && (
        <div className="text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded flex justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-teal-500 hover:text-teal-800">✕</button>
        </div>
      )}

      {/* ইনলাইন নতুন কেস ফর্ম */}
      {showCaseForm && (
        <form onSubmit={submitCase} className="bg-white p-4 rounded-xl shadow space-y-3">
          <div className="font-medium text-gray-700">নতুন কেস</div>
          <textarea
            className={input}
            name="symptoms"
            placeholder="লক্ষণ * (কমা দিয়ে আলাদা করুন)"
            rows="2"
            value={caseForm.symptoms}
            onChange={(e) => setCaseForm({ ...caseForm, symptoms: e.target.value })}
          />
          <textarea
            className={input}
            name="notes"
            placeholder="নোট / পর্যবেক্ষণ"
            rows="2"
            value={caseForm.notes}
            onChange={(e) => setCaseForm({ ...caseForm, notes: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="bg-teal-600 text-white rounded-md px-4 py-2 hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? 'সংরক্ষণ হচ্ছে…' : 'কেস সংরক্ষণ করো'}
            </button>
            <button
              type="button"
              onClick={toggleCaseForm}
              className="rounded-md px-4 py-2 bg-gray-200 hover:bg-gray-300"
            >
              বাতিল
            </button>
          </div>
        </form>
      )}

      {/* পরিসংখ্যান */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-3xl font-bold text-teal-700">{caseCount}</div>
          <div className="text-sm text-gray-500">কেস</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-3xl font-bold text-amber-600">{rxCount}</div>
          <div className="text-sm text-gray-500">প্রেসক্রিপশন</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 col-span-2 sm:col-span-1">
          <div className="text-sm text-gray-500">সর্বশেষ সাক্ষাৎ</div>
          <div className="text-lg font-semibold text-gray-700">
            {caseCount ? p.cases[0].date : '—'}
          </div>
        </div>
      </div>

      {/* টাইমলাইন */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3">কেস টাইমলাইন</h3>

        {caseCount === 0 && (
          <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-400">
            এই রোগীর এখনো কোনো কেস নেই।
          </div>
        )}

        {caseCount > 0 && (
          <ol className="relative border-l-2 border-teal-200 ml-2 space-y-5">
            {p.cases.map((c) => (
              <li key={c.id} className="ml-5">
                <span className="absolute -left-[9px] mt-1.5 w-4 h-4 rounded-full bg-teal-500 border-2 border-white" />
                <div className="bg-white rounded-xl shadow p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-gray-700">কেস #{c.id}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{c.date}</span>
                      <Link to={`/print/${c.id}`} className="text-xs text-teal-700 hover:underline">
                        🖨 প্রিন্ট / PDF
                      </Link>
                      <button
                        onClick={() => (editCaseId === c.id ? cancelEditCase() : startEditCase(c))}
                        className="text-xs text-teal-700 hover:underline"
                      >
                        {editCaseId === c.id ? 'বাতিল' : 'সম্পাদনা'}
                      </button>
                      <button
                        onClick={() => onDeleteCase(c)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        মুছুন
                      </button>
                    </div>
                  </div>

                  {editCaseId === c.id ? (
                    <form onSubmit={(e) => submitEditCase(e, c.id)} className="space-y-2">
                      <textarea
                        className={input}
                        placeholder="লক্ষণ *"
                        rows="2"
                        value={editCaseForm.symptoms}
                        onChange={(e) => setEditCaseForm({ ...editCaseForm, symptoms: e.target.value })}
                      />
                      <textarea
                        className={input}
                        placeholder="নোট / পর্যবেক্ষণ"
                        rows="2"
                        value={editCaseForm.notes}
                        onChange={(e) => setEditCaseForm({ ...editCaseForm, notes: e.target.value })}
                      />
                      <button
                        disabled={busy}
                        className="bg-teal-600 text-white rounded-md px-4 py-2 hover:bg-teal-700 disabled:opacity-50"
                      >
                        {busy ? 'সংরক্ষণ হচ্ছে…' : 'হালনাগাদ করো'}
                      </button>
                    </form>
                  ) : (
                    <>
                      {c.symptoms && <div className="text-sm"><b>লক্ষণ:</b> {c.symptoms}</div>}
                      {c.notes && <div className="text-sm"><b>নোট:</b> {c.notes}</div>}
                    </>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-gray-600">প্রেসক্রিপশন</div>
                      <button
                        onClick={() => toggleRx(c.id)}
                        className="text-xs text-teal-700 hover:underline"
                      >
                        {rxForCase === c.id ? 'বাতিল' : '+ প্রেসক্রিপশন'}
                      </button>
                    </div>

                    {c.prescriptions.length === 0 ? (
                      <div className="text-xs text-gray-400">কোনো ওষুধ যোগ করা হয়নি।</div>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {c.prescriptions.map((rx) => (
                          <li
                            key={rx.id}
                            className="text-sm bg-amber-50 border border-amber-200 rounded-md px-2 py-1 flex items-center gap-2"
                          >
                            <span>
                              <b className="text-amber-800">{rx.remedy_name}</b>
                              {rx.potency && <span className="text-gray-500"> · {rx.potency}</span>}
                              {rx.dose && <span className="text-gray-500"> · {rx.dose}</span>}
                            </span>
                            <button
                              onClick={() => startEditRx(c.id, rx)}
                              title="সম্পাদনা"
                              className="text-amber-600 hover:text-amber-800"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => onDeleteRx(c.id, rx)}
                              title="মুছুন"
                              className="text-red-500 hover:text-red-700"
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
                        className="mt-3 p-3 bg-gray-50 rounded-lg border space-y-2"
                      >
                        <div className="grid sm:grid-cols-3 gap-2">
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
                          <input
                            className={input}
                            placeholder="মাত্রা (যেমন: ৪ ডোজ)"
                            value={rxForm.dose}
                            onChange={(e) => setRxForm({ ...rxForm, dose: e.target.value })}
                          />
                        </div>
                        <button
                          disabled={busy}
                          className="bg-amber-600 text-white rounded-md px-4 py-2 hover:bg-amber-700 disabled:opacity-50"
                        >
                          {busy ? 'যোগ হচ্ছে…' : 'ওষুধ যোগ করো'}
                        </button>
                      </form>
                    )}

                    {editRx?.caseId === c.id && (
                      <form
                        onSubmit={submitEditRx}
                        className="mt-3 p-3 bg-gray-50 rounded-lg border space-y-2"
                      >
                        <div className="text-xs text-gray-500">প্রেসক্রিপশন সম্পাদনা</div>
                        <div className="grid sm:grid-cols-3 gap-2">
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
                          <input
                            className={input}
                            placeholder="মাত্রা"
                            value={editRxForm.dose}
                            onChange={(e) => setEditRxForm({ ...editRxForm, dose: e.target.value })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={busy}
                            className="bg-teal-600 text-white rounded-md px-4 py-2 hover:bg-teal-700 disabled:opacity-50"
                          >
                            {busy ? 'সংরক্ষণ হচ্ছে…' : 'হালনাগাদ করো'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditRx}
                            className="rounded-md px-4 py-2 bg-gray-200 hover:bg-gray-300"
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
