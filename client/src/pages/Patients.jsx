import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

const empty = { name: '', age: '', gender: '', phone: '' };
const input = 'border rounded-md px-3 py-2 w-full';

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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">রোগী ব্যবস্থাপনা</h2>

      {msg && (
        <div className="text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded flex justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-teal-500 hover:text-teal-800">✕</button>
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white p-4 rounded-xl shadow space-y-3">
        <div className="font-medium text-gray-700">
          {editingId ? 'রোগী সম্পাদনা' : 'নতুন রোগী যোগ করুন'}
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <input className={input} name="name" placeholder="নাম *" value={form.name} onChange={onChange} required />
          <input className={input} name="age" type="number" placeholder="বয়স" value={form.age} onChange={onChange} />
          <input className={input} name="gender" placeholder="লিঙ্গ" value={form.gender} onChange={onChange} />
          <input className={input} name="phone" placeholder="ফোন" value={form.phone} onChange={onChange} />
        </div>
        <div className="flex gap-2">
          <button className="bg-teal-600 text-white rounded-md px-4 py-2 hover:bg-teal-700">
            {editingId ? 'হালনাগাদ করো' : 'যোগ করো'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-md px-4 py-2 bg-gray-200 hover:bg-gray-300">
              বাতিল
            </button>
          )}
        </div>
      </form>

      <div>
        <input
          className={input + ' max-w-sm'}
          placeholder="🔍 নাম বা ফোন দিয়ে খুঁজুন..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">নাম</th>
              <th className="p-3">বয়স</th>
              <th className="p-3">লিঙ্গ</th>
              <th className="p-3">ফোন</th>
              <th className="p-3">যোগ হয়েছে</th>
              <th className="p-3 text-right">কাজ</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">
                  <Link to={`/patients/${p.id}`} className="text-teal-700 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="p-3">{p.age}</td>
                <td className="p-3">{p.gender}</td>
                <td className="p-3">{p.phone}</td>
                <td className="p-3 text-gray-500">{p.created_at}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => startEdit(p)} className="text-teal-600 hover:underline mr-3">সম্পাদনা</button>
                  <button onClick={() => onDelete(p)} className="text-red-600 hover:underline">মুছুন</button>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr><td className="p-4 text-gray-500" colSpan={6}>কোনো রোগী পাওয়া যায়নি।</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
