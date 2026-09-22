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
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">বিশ্লেষণ (রেপার্টরাইজেশন)</h2>
      <p className="text-sm text-gray-500">
        রোগীর লক্ষণ অনুযায়ী রুব্রিক বেছে নিন, অথবা রেপার্টরি থেকে পাঠান।
      </p>

      {msg && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{msg}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <input
            className="border rounded-md px-3 py-2 w-full"
            placeholder="🔍 রুব্রিক খুঁজুন..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="bg-white rounded-xl shadow p-4 max-h-96 overflow-auto">
            {filtered.map((r) => (
              <label key={r.id} className="flex items-center gap-2 py-1 cursor-pointer">
                <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                <span className="text-xs text-gray-400">{r.section}</span>
                <span className="text-sm">{r.rubric_text}</span>
              </label>
            ))}
            {filtered.length === 0 && <div className="text-sm text-gray-400">কোনো রুব্রিক নেই।</div>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => analyze(selected)} className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700">
              বিশ্লেষণ করো ({selected.length})
            </button>
            <button onClick={() => { setSelected([]); setResults(null); }} className="bg-gray-200 px-4 py-2 rounded-md hover:bg-gray-300">
              রিসেট
            </button>
          </div>
        </div>

        <div>
          {results && (
            <div className="bg-white rounded-xl shadow divide-y">
              {results.map((r, i) => (
                <div key={r.remedy_id}>
                  <div className={`flex items-stretch ${i === 0 ? 'bg-teal-50' : ''}`}>
                    <button
                      onClick={() => setExpanded(expanded === r.remedy_id ? null : r.remedy_id)}
                      className="flex-1 p-3 flex justify-between items-center text-left hover:bg-black/5"
                    >
                      <span>
                        <b className="text-teal-700">{i + 1}. {r.name}</b>
                        {i === 0 && (
                          <span className="ml-2 text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full">শীর্ষ</span>
                        )}
                        <span className="text-xs text-gray-400 ml-2">{r.hits} রুব্রিকে মিল</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold">{r.total}</span>
                        <span className="text-gray-400">{expanded === r.remedy_id ? '−' : '+'}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => openRx(r)}
                      title="প্রেসক্রিপশনে যোগ করো"
                      className="px-3 text-amber-600 hover:bg-amber-50 border-l"
                    >
                      💊
                    </button>
                  </div>

                  {expanded === r.remedy_id && (
                    <div className="px-4 pb-3 text-sm space-y-1 border-t bg-gray-50">
                      <div className="text-xs text-gray-500 italic">উৎস: {r.source}</div>
                      <div className="text-gray-700"><b>কী-নোট:</b> {r.keynotes}</div>
                    </div>
                  )}

                  {rx?.remedy_id === r.remedy_id && (
                    <div className="px-4 py-3 border-t bg-amber-50 space-y-2">
                      <div className="text-sm font-medium text-gray-700">
                        💊 {r.name} প্রেসক্রাইব করুন
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="border rounded-md px-2 py-1 text-sm"
                          value={rxForm.patient_id}
                          onChange={(e) => setRxForm({ ...rxForm, patient_id: e.target.value, case_id: 'new' })}
                        >
                          <option value="">— রোগী —</option>
                          {patients.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          className="border rounded-md px-2 py-1 text-sm"
                          value={rxForm.case_id}
                          onChange={(e) => setRxForm({ ...rxForm, case_id: e.target.value })}
                        >
                          <option value="new">নতুন কেস</option>
                          {patientCases.map((c) => (
                            <option key={c.id} value={c.id}>কেস #{c.id}</option>
                          ))}
                        </select>
                        <select
                          className="border rounded-md px-2 py-1 text-sm"
                          value={rxForm.potency}
                          onChange={(e) => setRxForm({ ...rxForm, potency: e.target.value })}
                        >
                          {potencies.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input
                          className="border rounded-md px-2 py-1 text-sm"
                          placeholder="মাত্রা"
                          value={rxForm.dose}
                          onChange={(e) => setRxForm({ ...rxForm, dose: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={submitRx} className="bg-amber-500 text-white rounded-md px-3 py-1 text-sm hover:bg-amber-600">
                          সংরক্ষণ করো
                        </button>
                        <button onClick={() => setRx(null)} className="bg-gray-200 rounded-md px-3 py-1 text-sm hover:bg-gray-300">
                          বাতিল
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {results.length === 0 && <div className="p-4 text-gray-500">কোনো ফলাফল নেই।</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
