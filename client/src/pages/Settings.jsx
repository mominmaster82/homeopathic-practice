import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const input = 'border rounded-md px-3 py-2 w-full';
const label = 'block text-sm font-medium text-gray-600 mb-1';

const EMPTY = {
  clinic_name: '',
  doctor_name: '',
  address: '',
  phone: '',
  email: '',
  footer_note: '',
  logo: '',
};

export default function Settings() {
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then((s) => setForm((f) => ({ ...f, ...s })))
      .catch((e) => { setMsg(e.message); setOk(false); });
  }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // লোগো ছবি → base64 ডেটা URL
  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg('শুধুমাত্র ছবি ফাইল দিন'); setOk(false); return;
    }
    if (file.size > 1_500_000) {
      setMsg('লোগো ছবি ১.৫ এমবির ছোট হতে হবে'); setOk(false); return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api.updateSettings(form);
      setForm((f) => ({ ...f, ...saved }));
      setMsg('সেটিংস সংরক্ষিত হয়েছে'); setOk(true);
    } catch (err) {
      setMsg(err.message); setOk(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">সেটিংস</h2>
        <p className="text-sm text-gray-500">
          এখানে ক্লিনিকের পরিচয় দিন — প্রেসক্রিপশন প্রিন্ট/রিসিটের উপরে এগুলো দেখাবে।
        </p>
      </div>

      {msg && (
        <div className={`text-sm px-3 py-2 rounded ${ok ? 'text-teal-700 bg-teal-50' : 'text-red-600 bg-red-50'}`}>
          {msg}
        </div>
      )}

      <form onSubmit={save} className="bg-white rounded-xl shadow p-5 space-y-4 max-w-2xl">
        {/* লোগো */}
        <div>
          <span className={label}>লোগো</span>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border flex items-center justify-center overflow-hidden bg-gray-50">
              {form.logo
                ? <img src={form.logo} alt="লোগো" className="w-full h-full object-contain" />
                : <span className="text-xs text-gray-400">কোনো লোগো নেই</span>}
            </div>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={onLogo}
                className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
              {form.logo && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, logo: '' })}
                  className="block text-xs text-red-600 hover:underline"
                >
                  লোগো সরান
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>ক্লিনিকের নাম</label>
            <input className={input} name="clinic_name" value={form.clinic_name || ''} onChange={onChange} placeholder="যেমন: হোমিওপ্যাথি ক্লিনিক" />
          </div>
          <div>
            <label className={label}>চিকিৎসকের নাম</label>
            <input className={input} name="doctor_name" value={form.doctor_name || ''} onChange={onChange} placeholder="যেমন: ডাঃ রহিম উদ্দিন" />
          </div>
          <div>
            <label className={label}>ফোন</label>
            <input className={input} name="phone" value={form.phone || ''} onChange={onChange} placeholder="যেমন: ০১৭XXXXXXXX" />
          </div>
          <div>
            <label className={label}>ইমেইল</label>
            <input className={input} name="email" value={form.email || ''} onChange={onChange} placeholder="clinic@example.com" />
          </div>
        </div>

        <div>
          <label className={label}>ঠিকানা</label>
          <textarea className={input} name="address" rows={2} value={form.address || ''} onChange={onChange} placeholder="ক্লিনিকের ঠিকানা" />
        </div>

        <div>
          <label className={label}>রিসিটের নিচের নোট</label>
          <textarea className={input} name="footer_note" rows={2} value={form.footer_note || ''} onChange={onChange} placeholder="যেমন: পরবর্তী সাক্ষাৎ ৭ দিন পর" />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-teal-600 text-white rounded-md px-5 py-2 hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করো'}
        </button>
      </form>
    </div>
  );
}
