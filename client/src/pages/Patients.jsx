import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

const empty = { name: '', age: '', gender: '', phone: '' };

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(
    (q = '') => api.getPatients(q).then(setPatients).catch((e) => setMsg(e.message)),
    []
  );
  useEffect(() => { load(); }, [load]);

  // সার্চ বক্সে লিখলে (৩০০ms পর) খোঁজা হবে
  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => { setForm(empty); setEditingId(null); };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updatePatient(editingId, form);
        setMsg('রোগী হালনাগাদ হয়েছে');
      } else {
        await api.addPatient(form);
        setMsg('রোগী যোগ হয়েছে');
      }
      resetForm();
      load(query);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name || '', age: p.age ?? '', gender: p.gender || '', phone: p.phone || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDelete = async (p) => {
    if (!confirm(`"${p.name}" কে মুছে ফেলবেন? সংশ্লিষ্ট সব কেসও মুছে যাবে।`)) return;
    try {
      await api.deletePatient(p.id);
      if (editingId === p.id) resetForm();
      setMsg('রোগী মুছে ফেলা হয়েছে');
      load(query);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">রোগী ব্যবস্থাপনা</h2>
        <p className="page-sub">রোগী যোগ, সম্পাদনা ও খোঁজা — সব এক জায়গায়।</p>
      </div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-sm text-teal-700">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-teal-500 hover:text-teal-800" title="বন্ধ করুন">
            ✕
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">
            {editingId ? 'রোগী সম্পাদনা' : 'নতুন রোগী যোগ করুন'}
          </h3>
          {editingId && (
            <span className="badge border-amber-200 bg-amber-50 text-amber-700">সম্পাদনা মোড</span>
          )}
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="label">নাম *</label>
            <input className="input" name="name" placeholder="রোগীর নাম" value={form.name} onChange={onChange} required />
          </div>
          <div>
            <label className="label">বয়স</label>
            <input className="input" name="age" type="number" placeholder="বছর" value={form.age} onChange={onChange} />
          </div>
          <div>
            <label className="label">লিঙ্গ</label>
            <select className="input" name="gender" value={form.gender} onChange={onChange}>
              <option value="">— লিঙ্গ নির্বাচন —</option>
              {form.gender && !['পুরুষ', 'মহিলা', 'অন্যান্য'].includes(form.gender) && (
                <option value={form.gender}>{form.gender}</option>
              )}
              <option value="পুরুষ">পুরুষ</option>
              <option value="মহিলা">মহিলা</option>
              <option value="অন্যান্য">অন্যান্য</option>
            </select>
          </div>
          <div>
            <label className="label">ফোন</label>
            <input className="input" name="phone" placeholder="মোবাইল নম্বর" value={form.phone} onChange={onChange} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            {editingId ? 'হালনাগাদ করো' : '＋ যোগ করো'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="btn btn-ghost">
              বাতিল
            </button>
          )}
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <input
          className="input max-w-sm"
          placeholder="🔍 নাম বা ফোন দিয়ে খুঁজুন..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-xs text-slate-400">{patients.length} জন রোগী</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">নাম</th>
                <th className="px-4 py-3 font-semibold">বয়স</th>
                <th className="px-4 py-3 font-semibold">লিঙ্গ</th>
                <th className="px-4 py-3 font-semibold">ফোন</th>
                <th className="px-4 py-3 font-semibold">যোগ হয়েছে</th>
                <th className="px-4 py-3 font-semibold text-right">কাজ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700 text-xs font-semibold">
                        {(p.name || '?').trim().charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <Link to={`/patients/${p.id}`} className="font-medium text-slate-800 hover:text-teal-700 hover:underline">
                          {p.name}
                        </Link>
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500" title="রোগীর সিরিয়াল নং">
                          #{p.id}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.age || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.gender || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{p.created_at}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(p)} className="text-xs font-medium text-teal-600 hover:underline mr-3">
                      সম্পাদনা
                    </button>
                    <button onClick={() => onDelete(p)} className="text-xs font-medium text-red-600 hover:underline">
                      মুছুন
                    </button>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-400" colSpan={6}>
                    কোনো রোগী পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
