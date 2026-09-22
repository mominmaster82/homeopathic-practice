import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';

const input = 'border rounded-md px-3 py-2 w-full';
const potencies = ['6C', '30C', '200C', '1M', '0/1 (LM)', 'Q (মাতৃটিংচার)'];

export default function CaseTaking() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [remedies, setRemedies] = useState([]);
  const [msg, setMsg] = useState('');

  // নতুন কেস ফর্ম
  const [form, setForm] = useState({ patient_id: '', symptoms: '', notes: '' });

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

  const submitCase = async (e) => {
    e.preventDefault();
    if (!form.patient_id) { setMsg('রোগী নির্বাচন করুন'); return; }
    try {
      const { id } = await api.addCase(form);
      setMsg(`কেস সংরক্ষিত হয়েছে (#${id})`);
      setForm({ patient_id: '', symptoms: '', notes: '' });
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
      <h2 className="text-2xl font-bold text-gray-800">কেস টেকিং ও প্রেসক্রিপশন</h2>

      {msg && (
        <div className="text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded flex justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-teal-500 hover:text-teal-800">✕</button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* নতুন কেস */}
        <form onSubmit={submitCase} className="bg-white p-4 rounded-xl shadow space-y-3 self-start">
          <div className="font-medium text-gray-700">নতুন কেস</div>
          <select className={input} name="patient_id" value={form.patient_id} onChange={onChange} required>
            <option value="">— রোগী নির্বাচন —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age})` : ''}</option>
            ))}
          </select>
          <textarea
            className={input} name="symptoms" rows={4}
            placeholder="লক্ষণ, মডালিটি, সেনসেশন লিখুন..."
            value={form.symptoms} onChange={onChange}
          />
          <textarea
            className={input} name="notes" rows={2}
            placeholder="অতিরিক্ত নোট"
            value={form.notes} onChange={onChange}
          />
          <button className="bg-teal-600 text-white rounded-md px-4 py-2 hover:bg-teal-700">
            কেস সংরক্ষণ করো
          </button>
        </form>

        {/* হিস্ট্রি */}
        <div className="bg-white p-4 rounded-xl shadow space-y-3">
          <div className="font-medium text-gray-700">কেস হিস্ট্রি</div>
          <select className={input} value={historyPatient} onChange={(e) => setHistoryPatient(e.target.value)}>
            <option value="">— রোগী নির্বাচন —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age})` : ''}</option>
            ))}
          </select>

          <div className="space-y-2 max-h-[28rem] overflow-auto">
            {cases.map((c) => (
              <div key={c.id} className="border rounded-lg">
                <button
                  onClick={() => openCaseDetail(c.id)}
                  className="w-full text-left px-3 py-2 hover:bg-teal-50 flex justify-between"
                >
                  <span>কেস #{c.id}</span>
                  <span className="text-xs text-gray-400">{c.date}</span>
                </button>

                {openCase === c.id && caseDetail && (
                  <div className="px-3 pb-3 space-y-3 border-t pt-2">
                    {c.symptoms && <div className="text-sm"><b>লক্ষণ:</b> {c.symptoms}</div>}
                    {c.notes && <div className="text-sm"><b>নোট:</b> {c.notes}</div>}

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">প্রেসক্রিপশন</span>
                        <button
                          onClick={() => navigate(`/print/${c.id}`)}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          🖨 প্রিন্ট / PDF
                        </button>
                      </div>
                      {caseDetail.prescriptions.length === 0 && (
                        <div className="text-xs text-gray-400">এখনো কোনো ওষুধ যোগ করা হয়নি।</div>
                      )}
                      <ul className="space-y-1">
                        {caseDetail.prescriptions.map((p) => (
                          <li key={p.id} className="flex justify-between items-center text-sm bg-gray-50 px-2 py-1 rounded">
                            <span>
                              <b className="text-teal-700">{p.remedy_name}</b>
                              {p.potency && <span className="text-gray-500"> · {p.potency}</span>}
                              {p.dose && <span className="text-gray-500"> · {p.dose}</span>}
                            </span>
                            <button onClick={() => removeRx(c.id, p.id)} className="text-red-500 hover:underline text-xs">মুছুন</button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* প্রেসক্রিপশন যোগ */}
                    <div className="grid grid-cols-2 gap-2">
                      <select className={input} value={rx.remedy_id} onChange={(e) => setRx({ ...rx, remedy_id: e.target.value })}>
                        <option value="">— ওষুধ —</option>
                        {remedies.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <select className={input} value={rx.potency} onChange={(e) => setRx({ ...rx, potency: e.target.value })}>
                        {potencies.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input className={input + ' col-span-2'} placeholder="মাত্রা (যেমন: ৪ ডোজ, সকাল-সন্ধ্যা)" value={rx.dose} onChange={(e) => setRx({ ...rx, dose: e.target.value })} />
                      <button onClick={() => submitRx(c.id)} className="col-span-2 bg-amber-500 text-white rounded-md py-2 hover:bg-amber-600">
                        প্রেসক্রিপশন যোগ করো
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {historyPatient && cases.length === 0 && (
              <div className="text-sm text-gray-400">এই রোগীর কোনো কেস নেই।</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
