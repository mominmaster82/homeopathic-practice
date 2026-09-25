import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api.js';

export default function Analysis() {
  const location = useLocation();
  const [rubrics, setRubrics] = useState([]);
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState(null);
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null); // কী-নোট দেখানো ওষুধ

  // প্রেসক্রিপশন ফর্ম
  const [patients, setPatients] = useState([]);
  const [patientCases, setPatientCases] = useState([]);
  const [rx, setRx] = useState(null); // যে ওষুধ প্রেসক্রাইব করা হচ্ছে
  const [rxForm, setRxForm] = useState({ patient_id: '', case_id: 'new', potency: '30C', dose: '' });

  const potencies = ['6C', '30C', '200C', '1M', '0/1 (LM)', 'Q (মাতৃটিংচার)'];

  useEffect(() => {
    api.getRubrics().then(setRubrics).catch((e) => setMsg(e.message));
    api.getPatients().then(setPatients).catch(() => {});
  }, []);

  useEffect(() => {
    if (!rxForm.patient_id) { setPatientCases([]); return; }
    api.getCases(rxForm.patient_id).then(setPatientCases).catch(() => {});
  }, [rxForm.patient_id]);

  // রেপার্টরি থেকে পাঠানো রুব্রিক গ্রহণ
  useEffect(() => {
    const incoming = location.state?.rubricIds;
    if (Array.isArray(incoming) && incoming.length) {
      setSelected(incoming);
      analyze(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const analyze = async (ids) => {
    setMsg('');
    if (!ids || ids.length === 0) { setMsg('কমপক্ষে একটি রুব্রিক নির্বাচন করুন'); return; }
    try {
      setResults(await api.analyze(ids));
    } catch (e) {
      setMsg(e.message);
    }
  };

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const openRx = (remedy) => {
    setRx(remedy);
    setRxForm({ patient_id: '', case_id: 'new', potency: '30C', dose: '' });
  };

  const submitRx = async () => {
    if (!rxForm.patient_id) { setMsg('রোগী নির্বাচন করুন'); return; }
    try {
      let caseId = rxForm.case_id;
      if (caseId === 'new') {
        // নির্বাচিত রুব্রিকগুলোকে লক্ষণ হিসেবে লিখে নতুন কেস তৈরি
        const symptomTexts = rubrics
          .filter((r) => selected.includes(r.id))
          .map((r) => r.rubric_text)
          .join('; ');
        const created = await api.addCase({
          patient_id: rxForm.patient_id,
          symptoms: symptomTexts || null,
          notes: 'বিশ্লেষণ থেকে তৈরি',
        });
        caseId = created.id;
      }
      await api.addPrescription(caseId, {
        remedy_id: rx.remedy_id,
        potency: rxForm.potency,
        dose: rxForm.dose || null,
      });
      setMsg(`${rx.name} প্রেসক্রিপশনে যোগ হয়েছে (কেস #${caseId})`);
      setRx(null);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rubrics;
    return rubrics.filter((r) => r.rubric_text.toLowerCase().includes(q));
  }, [rubrics, query]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">বিশ্লেষণ (রেপার্টরাইজেশন)</h2>
        <p className="page-sub">
          রোগীর লক্ষণ অনুযায়ী রুব্রিক বেছে নিন, অথবা রেপার্টরি থেকে পাঠান।
        </p>
      </div>

      {msg && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">{msg}</div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <input
            className="input"
            placeholder="🔍 রুব্রিক খুঁজুন..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="card p-4 max-h-96 overflow-auto space-y-0.5">
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-3 mb-2 border-b border-slate-100">
                {rubrics.filter((r) => selected.includes(r.id)).map((r) => (
                  <span key={r.id} className="chip border-teal-200 bg-teal-50 text-teal-700">
                    {r.rubric_text}
                    <button type="button" onClick={() => toggle(r.id)} className="text-teal-500 hover:text-teal-800">×</button>
                  </span>
                ))}
              </div>
            )}
            {filtered.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 ${selected.includes(r.id) ? 'bg-teal-50/60' : ''}`}
              >
                <input type="checkbox" className="accent-teal-600" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                <span className="badge border-slate-200 bg-slate-50 text-slate-500 shrink-0">{r.section}</span>
                <span className="text-sm text-slate-700">{r.rubric_text}</span>
              </label>
            ))}
            {filtered.length === 0 && <div className="py-8 text-center text-sm text-slate-400">কোনো রুব্রিক নেই।</div>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => analyze(selected)} className="btn btn-primary">
              বিশ্লেষণ করো ({selected.length})
            </button>
            <button onClick={() => { setSelected([]); setResults(null); }} className="btn btn-ghost">
              রিসেট
            </button>
          </div>
        </div>

        <div>
          {results && (
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {results.map((r, i) => {
                const maxTotal = Math.max(...results.map((x) => x.total), 1);
                return (
                <div key={r.remedy_id}>
                  <div className={`flex items-stretch ${i === 0 ? 'bg-teal-50/70' : 'bg-white'}`}>
                    <button
                      onClick={() => setExpanded(expanded === r.remedy_id ? null : r.remedy_id)}
                      className="flex-1 p-4 flex flex-col gap-2 text-left hover:bg-slate-50/70"
                    >
                      <span className="flex justify-between items-center gap-2">
                        <span className="flex items-center gap-2 flex-wrap">
                          <b className="text-teal-700">{i + 1}. {r.name}</b>
                          {i === 0 && (
                            <span className="badge border-teal-600 bg-teal-600 text-white">শীর্ষ</span>
                          )}
                          <span className="badge border-slate-200 bg-slate-50 text-slate-500">{r.hits} রুব্রিকে মিল</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-lg font-bold text-slate-800">{r.total}</span>
                          <span className="text-slate-400">{expanded === r.remedy_id ? '−' : '+'}</span>
                        </span>
                      </span>
                      <span className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <span
                          className={`block h-full rounded-full ${i === 0 ? 'bg-teal-600' : 'bg-teal-400'}`}
                          style={{ width: `${Math.round((r.total / maxTotal) * 100)}%` }}
                        />
                      </span>
                    </button>
                    <button
                      onClick={() => openRx(r)}
                      title="প্রেসক্রিপশনে যোগ করো"
                      className="px-3.5 text-amber-600 hover:bg-amber-50 border-l border-slate-100"
                    >
                      💊
                    </button>
                  </div>

                  {expanded === r.remedy_id && (
                    <div className="px-4 pb-4 pt-3 text-sm space-y-2 border-t border-slate-100 bg-slate-50">
                      <div className="text-xs text-slate-500 italic">উৎস: {r.source}</div>
                      <div className="text-slate-700 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <b className="text-amber-800">কী-নোট:</b> {r.keynotes}
                      </div>
                    </div>
                  )}

                  {rx?.remedy_id === r.remedy_id && (
                    <div className="px-4 py-3.5 border-t border-slate-100 bg-amber-50/70 space-y-3">
                      <div className="text-sm font-semibold text-slate-700">
                        💊 {r.name} প্রেসক্রাইব করুন
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="input"
                          value={rxForm.patient_id}
                          onChange={(e) => setRxForm({ ...rxForm, patient_id: e.target.value, case_id: 'new' })}
                        >
                          <option value="">— রোগী —</option>
                          {patients.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          className="input"
                          value={rxForm.case_id}
                          onChange={(e) => setRxForm({ ...rxForm, case_id: e.target.value })}
                        >
                          <option value="new">নতুন কেস</option>
                          {patientCases.map((c) => (
                            <option key={c.id} value={c.id}>কেস #{c.id}</option>
                          ))}
                        </select>
                        <select
                          className="input"
                          value={rxForm.potency}
                          onChange={(e) => setRxForm({ ...rxForm, potency: e.target.value })}
                        >
                          {potencies.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input
                          className="input"
                          placeholder="মাত্রা"
                          value={rxForm.dose}
                          onChange={(e) => setRxForm({ ...rxForm, dose: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={submitRx} className="btn btn-primary btn-sm">
                          সংরক্ষণ করো
                        </button>
                        <button onClick={() => setRx(null)} className="btn btn-ghost btn-sm">
                          বাতিল
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
              {results.length === 0 && <div className="py-8 text-center text-sm text-slate-400">কোনো ফলাফল নেই।</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
