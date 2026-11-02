import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDateBD } from '../services/api.js';
import { searchRubrics, queryTokens } from '../utils/search.js';
import { extraCaseFields, emptyCaseFields } from './caseFields.js';

const input = 'input';
const potencies = ['6C', '30C', '200C', '1M', '0/1 (LM)', 'Q (মাতৃটিংচার)'];
const emptyCaseForm = { patient_id: '', rubrics: [], ...emptyCaseFields };

// একবার লোড হলেই পুরো সেশনে একই তালিকা — প্রতিবার পেজে ঢুকলে রুব্রিক আবার পড়তে হয় না
let rubricsPromise = null;
function loadRubricsOnce() {
  if (!rubricsPromise) rubricsPromise = api.getRubrics();
  return rubricsPromise;
}

// ফিল্ডের লেখা থেকে মিলে যাওয়া শীর্ষ ৩টি রুব্রিক।
// hint = ফিল্ডের নিজের বিষয় (যেমন তৃষ্ণা/ঘাম) — গদ্যের "অনেক পানি খান" থেকেও তৃষ্ণার রুব্রিক পেতে সাহায্য করে।
function suggestRubrics(rubrics, text, hint) {
  const q = String(text || '').trim();
  if (!rubrics || q.length < 2) return [];
  const tokens = [...new Set([...(hint ? [hint] : []), ...queryTokens(q)])];
  const merged = new Map();
  for (const t of tokens) {
    for (const hit of searchRubrics(rubrics, t).items.slice(0, 6)) {
      const cur = merged.get(hit.rubric.id) || { rubric: hit.rubric, matches: 0, score: 0 };
      cur.matches += 1;
      cur.score += hit.score;
      merged.set(hit.rubric.id, cur);
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.matches - a.matches || b.score - a.score)
    .slice(0, 3)
    .map((x) => x.rubric);
}

// লেখার সঙ্গে মিলে যাওয়া রুব্রিকের চিপ — ক্লিক করলেই কেসে যোগ/বাদ হয়
function RubricSuggestions({ items, pickedIds, onToggle }) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-slate-400">মিলে যাওয়া রুব্রিক:</span>
      {items.map((r) => {
        const added = pickedIds.includes(r.id);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onToggle(r)}
            title={`${r.section} › ${r.rubric_text} — ${added ? 'যোগ করা হয়েছে, বাদ দিতে ক্লিক করুন' : 'যোগ করুন'}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
              added
                ? 'border-teal-500 bg-teal-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700'
            }`}
          >
            <span className="font-semibold">{added ? '✓' : '+'}</span>
            <span className="max-w-[18rem] truncate">{r.rubric_text}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function CaseTaking() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [remedies, setRemedies] = useState([]);
  const [rubrics, setRubrics] = useState(null);
  const [msg, setMsg] = useState('');

  // নতুন কেস ফর্ম
  const [form, setForm] = useState(emptyCaseForm);

  // নির্বাচিত রোগীর হিস্ট্রি
  const [historyPatient, setHistoryPatient] = useState('');
  const [cases, setCases] = useState([]);
  const [openCase, setOpenCase] = useState(null); // বিস্তারিত দেখানো কেস
  const [caseDetail, setCaseDetail] = useState(null);

  // প্রেসক্রিপশন ফর্ম
  const [rx, setRx] = useState({ remedy_id: '', potency: '30C', dose: '' });

  useEffect(() => {
    api.getPatients().then(setPatients).catch((e) => setMsg(e.message));
    api.getRemedies().then(setRemedies).catch(() => {});
    loadRubricsOnce().then(setRubrics).catch(() => {});
  }, []);

  const loadCases = useCallback((pid) => {
    if (!pid) { setCases([]); return; }
    api.getCases(pid).then(setCases).catch((e) => setMsg(e.message));
  }, []);

  useEffect(() => {
    loadCases(historyPatient);
    setOpenCase(null);
    setCaseDetail(null);
  }, [historyPatient, loadCases]);

  const openCaseDetail = async (id) => {
    if (openCase === id) { setOpenCase(null); setCaseDetail(null); return; }
    setOpenCase(id);
    setCaseDetail(await api.getCase(id));
  };

  const refreshDetail = async (id) => {
    setCaseDetail(await api.getCase(id));
    loadCases(historyPatient);
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const isPicked = (id) => form.rubrics.some((r) => r.id === id);

  const addRubric = (r) => {
    if (isPicked(r.id)) return;
    setForm({ ...form, rubrics: [...form.rubrics, { id: r.id, section: r.section, text: r.rubric_text }] });
  };

  const removeRubric = (id) => {
    setForm({ ...form, rubrics: form.rubrics.filter((r) => r.id !== id) });
  };

  const gotoAnalysis = () => {
    navigate('/analysis', { state: { rubricIds: form.rubrics.map((r) => r.id) } });
  };

  // রেপার্টরিতে যে শব্দগুলো আসলে আছে — গদ্যের অপ্রাসঙ্গিক শব্দ (যেমন "ভালোবাসেন") বাদ দিতে
  const suggestionsFor = (text, hint) => suggestRubrics(rubrics, text, hint);

  const toggleRubric = (r) => (isPicked(r.id) ? removeRubric(r.id) : addRubric(r));

  const submitCase = async (e) => {
    e.preventDefault();
    if (!form.patient_id) { setMsg('রোগী নির্বাচন করুন'); return; }
    try {
      const { id } = await api.addCase(form);
      setMsg(`কেস সংরক্ষিত হয়েছে (#${id})`);
      setForm(emptyCaseForm);
      setHistoryPatient(String(form.patient_id) === historyPatient ? historyPatient : String(form.patient_id));
      loadCases(form.patient_id);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const submitRx = async (caseId) => {
    if (!rx.remedy_id) { setMsg('ওষুধ নির্বাচন করুন'); return; }
    try {
      await api.addPrescription(caseId, rx);
      setRx({ remedy_id: '', potency: '30C', dose: '' });
      setMsg('প্রেসক্রিপশন যোগ হয়েছে');
      refreshDetail(caseId);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const removeRx = async (caseId, pid) => {
    if (!confirm('এই প্রেসক্রিপশন মুছে ফেলবেন?')) return;
    try {
      await api.deletePrescription(caseId, pid);
      refreshDetail(caseId);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">কেস টেকিং ও প্রেসক্রিপশন</h2>
        <p className="page-sub">রোগীর কেস রেকর্ড, হিস্ট্রি ও প্রেসক্রিপশন — সব এক জায়গায়।</p>
      </div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-800 shadow-soft">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-teal-500 hover:text-teal-800">✕</button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* নতুন কেস */}
        <form onSubmit={submitCase} className="card p-5 space-y-4 self-start">
          <div className="section-title">নতুন কেস</div>
          <div>
            <label className="label">রোগী</label>
            <select className={input} name="patient_id" value={form.patient_id} onChange={onChange} required>
              <option value="">— রোগী নির্বাচন —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">বর্তমান অবস্থা / লক্ষণ</label>
            <textarea
              className={input} name="symptoms" rows={4}
              placeholder="রোগী এখন কী কষ্টে আছে — ব্যথার ধরন ও স্থান, ব্যথা কেমন (ছেঁড়া/দপদপে/চাবকানোর মতো), কীভাবে শুরু হলো…"
              value={form.symptoms} onChange={onChange}
            />
            <RubricSuggestions
              items={suggestionsFor(form.symptoms)}
              pickedIds={form.rubrics.map((r) => r.id)}
              onToggle={toggleRubric}
            />
          </div>
          {extraCaseFields.map((f) => (
            <div key={f.name}>
              <label className="label">{f.label}</label>
              {f.type === 'input' ? (
                <input
                  className={input} type="text" name={f.name}
                  placeholder={f.placeholder}
                  value={form[f.name]} onChange={onChange}
                />
              ) : (
                <textarea
                  className={input} name={f.name} rows={2}
                  placeholder={f.placeholder}
                  value={form[f.name]} onChange={onChange}
                />
              )}
              <RubricSuggestions
                items={suggestionsFor(form[f.name], f.hint)}
                pickedIds={form.rubrics.map((r) => r.id)}
                onToggle={toggleRubric}
              />
            </div>
          ))}
          <div>
            <label className="label">নোট</label>
            <textarea
              className={input} name="notes" rows={2}
              placeholder="অতিরিক্ত নোট"
              value={form.notes} onChange={onChange}
            />
          </div>
          {form.rubrics.length > 0 && (
            <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-teal-800">নির্বাচিত রুব্রিক ({form.rubrics.length})</span>
                <button type="button" onClick={gotoAnalysis} className="text-xs font-medium text-teal-700 hover:underline">
                  বিশ্লেষণে পাঠান →
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.rubrics.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-white px-2 py-0.5 text-xs text-teal-800"
                    title={`${r.section} › ${r.text}`}
                  >
                    <span className="max-w-[16rem] truncate">{r.text}</span>
                    <button type="button" onClick={() => removeRubric(r.id)} className="text-teal-500 hover:text-red-600">✕</button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <button className="btn btn-primary w-full">
            কেস সংরক্ষণ করো
          </button>
        </form>

        {/* হিস্ট্রি */}
        <div className="card p-5 space-y-4">
          <div className="section-title">কেস হিস্ট্রি</div>
          <select className={input} value={historyPatient} onChange={(e) => setHistoryPatient(e.target.value)}>
            <option value="">— রোগী নির্বাচন —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age})` : ''}</option>
            ))}
          </select>

          <div className="space-y-2 max-h-[28rem] overflow-auto pr-1 -mr-1">
            {cases.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => openCaseDetail(c.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-teal-50 flex justify-between items-center text-sm font-medium text-slate-700"
                >
                  <span>কেস #{c.id}</span>
                  <span className="text-xs font-normal text-slate-400">{formatDateBD(c.date)}</span>
                </button>

                {openCase === c.id && caseDetail && (
                  <div className="px-4 pb-4 pt-3 space-y-4 border-t border-slate-100 bg-slate-50/60">
                    {c.symptoms && <div className="text-sm text-slate-700"><b className="text-slate-800">লক্ষণ:</b> {c.symptoms}</div>}
                    {extraCaseFields.map((f) => c[f.name] && (
                      <div key={f.name} className="text-sm text-slate-700"><b className="text-slate-800">{f.label}:</b> {c[f.name]}</div>
                    ))}
                    {c.notes && <div className="text-sm text-slate-700"><b className="text-slate-800">নোট:</b> {c.notes}</div>}
                    {c.rubrics?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-500">রুব্রিক:</span>
                        {c.rubrics.map((r) => (
                          <span key={r.id} className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs text-teal-800" title={`${r.section} › ${r.text}`}>
                            {r.text}
                          </span>
                        ))}
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="section-title">প্রেসক্রিপশন</span>
                        <button
                          onClick={() => navigate(`/print/${c.id}`)}
                          className="text-xs font-medium text-teal-700 hover:underline"
                        >
                          🖨 প্রিন্ট / PDF
                        </button>
                      </div>
                      {caseDetail.prescriptions.length === 0 && (
                        <div className="py-3 text-center text-xs text-slate-400">এখনো কোনো ওষুধ যোগ করা হয়নি।</div>
                      )}
                      <ul className="space-y-1.5">
                        {caseDetail.prescriptions.map((p) => (
                          <li key={p.id} className="flex justify-between items-center gap-2 text-sm bg-white border border-slate-100 px-3 py-1.5 rounded-lg">
                            <span>
                              <b className="text-teal-700">{p.remedy_name}</b>
                              {p.potency && <span className="text-slate-500"> · {p.potency}</span>}
                              {p.dose && <span className="text-slate-500"> · {p.dose}</span>}
                            </span>
                            <button onClick={() => removeRx(c.id, p.id)} className="btn btn-danger btn-sm shrink-0">মুছুন</button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* প্রেসক্রিপশন যোগ */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      <select className={input} value={rx.remedy_id} onChange={(e) => setRx({ ...rx, remedy_id: e.target.value })}>
                        <option value="">— ওষুধ —</option>
                        {remedies.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <select className={input} value={rx.potency} onChange={(e) => setRx({ ...rx, potency: e.target.value })}>
                        {potencies.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <div className="col-span-2">
                        <label className="label">সেবনবিধি / মাত্রা</label>
                        <textarea
                          className={input} rows={2}
                          placeholder="বিস্তারিত লিখুন যাতে সাধারণ মানুষও বোঝে — যেমন: সকালে ও রাতে খালি পেটে ২টি করে পিল, ৭ দিন খাবেন"
                          value={rx.dose} onChange={(e) => setRx({ ...rx, dose: e.target.value })}
                        />
                      </div>
                      <button onClick={() => submitRx(c.id)} className="col-span-2 btn bg-amber-500 text-white hover:bg-amber-600 shadow-soft">
                        প্রেসক্রিপশন যোগ করো
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {historyPatient && cases.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">এই রোগীর কোনো কেস নেই।</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
