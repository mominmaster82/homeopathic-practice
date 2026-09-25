import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const input = 'input';
const label = 'label';

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
  const [backupMsg, setBackupMsg] = useState('');
  const [backupOk, setBackupOk] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwOk, setPwOk] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

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

  // ব্যাকআপ ডাউনলোড
  const downloadBackup = async () => {
    setBackupBusy(true);
    setBackupMsg('');
    try {
      const backup = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homeopathy-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg('ব্যাকআপ ডাউনলোড সম্পন্ন'); setBackupOk(true);
    } catch (err) {
      setBackupMsg(err.message); setBackupOk(false);
    } finally {
      setBackupBusy(false);
    }
  };

  // ব্যাকআপ রিস্টোর
  const restoreBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('সতর্কতা: সব বর্তমান ডেটা মুছে গিয়ে ব্যাকআপের ডেটা বসবে। চালিয়ে যাবেন?')) {
      e.target.value = '';
      return;
    }

    setBackupBusy(true);
    setBackupMsg('');
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const result = await api.importBackup(backup);
      setBackupMsg(result.message || 'ব্যাকআপ রিস্টোর সম্পন্ন'); setBackupOk(true);
      // রিস্টোরের পর সেটিংস রিফ্রেশ
      api.getSettings().then((s) => setForm((f) => ({ ...f, ...s }))).catch(() => {});
    } catch (err) {
      setBackupMsg('রিস্টোর ব্যর্থ: ' + err.message); setBackupOk(false);
    } finally {
      setBackupBusy(false);
      e.target.value = '';
    }
  };

  // পাসওয়ার্ড পরিবর্তন
  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg('');

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg('নতুন পাসওয়ার্ড দুটি মিলছে না'); setPwOk(false);
      return;
    }

    setPwBusy(true);
    try {
      const result = await api.changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwMsg(result.message || 'পাসওয়ার্ড পরিবর্তিত হয়েছে'); setPwOk(true);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg(err.message); setPwOk(false);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="page-title">সেটিংস</h2>
        <p className="page-sub">
          এখানে ক্লিনিকের পরিচয় দিন — প্রেসক্রিপশন প্রিন্ট/রিসিটের উপরে এগুলো দেখাবে।
        </p>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2.5 rounded-lg border ${ok ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {msg}
        </div>
      )}

      <form onSubmit={save} className="card p-5 space-y-4">
        <h3 className="section-title">ক্লিনিকের পরিচয়</h3>

        {/* লোগো */}
        <div>
          <span className={label}>লোগো</span>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
              {form.logo
                ? <img src={form.logo} alt="লোগো" className="w-full h-full object-contain" />
                : <span className="text-xs text-slate-400 px-1 text-center">কোনো লোগো নেই</span>}
            </div>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={onLogo}
                className="text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:text-sm file:font-medium hover:file:bg-teal-100 file:cursor-pointer"
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
          className="btn btn-primary"
        >
          {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করো'}
        </button>
      </form>

      {/* ব্যাকআপ সেকশন */}
      <div className="card p-5 space-y-4">
        <div>
          <h3 className="section-title">ডেটা ব্যাকআপ</h3>
          <p className="text-sm text-slate-500 mt-1">
            সব রোগী, কেস, প্রেসক্রিপশন ও সেটিংস JSON ফাইলে সংরক্ষণ করুন বা পূর্বে সংরক্ষিত ব্যাকআপ ফিরিয়ে আনুন।
          </p>
        </div>

        {backupMsg && (
          <div className={`text-sm px-4 py-2.5 rounded-lg border ${backupOk ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
            {backupMsg}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadBackup}
            disabled={backupBusy}
            className="btn btn-primary"
          >
            {backupBusy ? 'প্রস্তুত হচ্ছে…' : '⬇ ব্যাকআপ ডাউনলোড'}
          </button>

          <label className="btn btn-ghost cursor-pointer">
            {backupBusy ? 'প্রস্তুত হচ্ছে…' : '⬆ ব্যাকআপ রিস্টোর'}
            <input
              type="file"
              accept=".json,application/json"
              onChange={restoreBackup}
              disabled={backupBusy}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-xs text-slate-400 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">
          💡 নিয়মিত ব্যাকআপ নিন। রিস্টোর করলে বর্তমান সব ডেটা মুছে যাবে এবং ব্যাকআপের ডেটা বসবে।
        </p>
      </div>

      {/* পাসওয়ার্ড পরিবর্তন সেকশন */}
      <form onSubmit={changePassword} className="card p-5 space-y-4">
        <div>
          <h3 className="section-title">পাসওয়ার্ড পরিবর্তন</h3>
          <p className="text-sm text-slate-500 mt-1">
            প্রথমবার ডিফল্ট পাসওয়ার্ড <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-xs">admin</code> দিয়ে লগইন করলে এখান থেকে নিজের পাসওয়ার্ড সেট করুন।
          </p>
        </div>

        {pwMsg && (
          <div className={`text-sm px-4 py-2.5 rounded-lg border ${pwOk ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
            {pwMsg}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>পুরনো পাসওয়ার্ড</label>
            <input
              type="password"
              className={input}
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>নতুন পাসওয়ার্ড</label>
            <input
              type="password"
              className={input}
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              required
              minLength={4}
            />
          </div>
          <div>
            <label className={label}>নতুন পাসওয়ার্ড আবার</label>
            <input
              type="password"
              className={input}
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              required
              minLength={4}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pwBusy}
          className="btn btn-primary"
        >
          {pwBusy ? 'পরিবর্তন হচ্ছে…' : 'পাসওয়ার্ড পরিবর্তন করো'}
        </button>
      </form>
    </div>
  );
}
