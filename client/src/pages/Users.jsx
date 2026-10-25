import { useEffect, useMemo, useState } from 'react';
import { api, formatDateBD } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'subscriber', status: 'active' };

const roleLabel = (role) => (role === 'super_admin' ? 'সুপার অ্যাডমিন' : 'সাবস্ক্রাইবার');

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null); // { text, ok }

  const loadUsers = async () => {
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      admins: users.filter((u) => u.role === 'super_admin').length,
    }),
    [users]
  );

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const created = await api.createUserAccount(form);
      setNotice({
        text: `${created.email} — ইউজার তৈরি হয়েছে। ইমেইল ও পাসওয়ার্ডটি ইউজারকে জানিয়ে দিন।`,
        ok: true,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (u, role) => {
    if (role === u.role) return;
    setBusyId(u.id);
    setNotice(null);
    try {
      await api.updateUserAccess(u.id, { role });
      setNotice({ text: `${u.email || u.name} — রোল এখন ${roleLabel(role)}`, ok: true });
      await loadUsers();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (u) => {
    const status = u.status === 'active' ? 'suspended' : 'active';
    setBusyId(u.id);
    setNotice(null);
    try {
      await api.updateUserAccess(u.id, { status });
      setNotice({
        text: `${u.email || u.name} — ${status === 'active' ? 'সক্রিয়' : 'স্থগিত'} করা হয়েছে`,
        ok: true,
      });
      await loadUsers();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setBusyId(null);
    }
  };

  const removeAccess = async (u) => {
    const label = u.email || u.name || 'এই ইউজার';
    const sure = confirm(
      `${label} এর অ্যাক্সেস স্থায়ীভাবে বাতিল করবেন?\n\nপ্রোফাইল মুছে যাবে — ইউজার আর কোনো পেজে ঢুকতে পারবে না।`
    );
    if (!sure) return;
    setBusyId(u.id);
    setNotice(null);
    try {
      await api.deleteUserAccess(u.id);
      setNotice({ text: `${label} — অ্যাক্সেস বাতিল হয়েছে`, ok: true });
      await loadUsers();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">ইউজার ম্যানেজমেন্ট</h2>
          <p className="page-sub">
            সাবস্ক্রাইবার তৈরি করুন এবং কার কতটুকু অ্যাক্সেস থাকবে তা নিয়ন্ত্রণ করুন।
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setNotice(null);
          }}
          className="btn btn-ghost"
        >
          {showForm ? '✕ বন্ধ করুন' : '＋ নতুন ইউজার'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-slate-800">{counts.total}</div>
          <div className="text-xs text-slate-500">মোট ইউজার</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-teal-700">{counts.active}</div>
          <div className="text-xs text-slate-500">সক্রিয়</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-slate-800">{counts.admins}</div>
          <div className="text-xs text-slate-500">সুপার অ্যাডমিন</div>
        </div>
      </div>

      {notice && (
        <div
          className={`text-sm px-4 py-2.5 rounded-lg border ${
            notice.ok
              ? 'text-teal-700 bg-teal-50 border-teal-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">নতুন ইউজার তৈরি করুন</h3>
            <span className="text-[11px] text-slate-400">ইমেইল ও পাসওয়ার্ড দিয়েই লগইন হবে</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">নাম</label>
              <input
                className="input"
                value={form.name}
                onChange={update('name')}
                placeholder="যেমন: ডা. করিম"
              />
            </div>
            <div>
              <label className="label">ইমেইল *</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={update('email')}
                placeholder="user@example.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">পাসওয়ার্ড *</label>
              <input
                className="input"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={update('password')}
                placeholder="কমপক্ষে ৬ অক্ষর"
                autoComplete="new-password"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">রোল</label>
                <select className="input" value={form.role} onChange={update('role')}>
                  <option value="subscriber">সাবস্ক্রাইবার</option>
                  <option value="super_admin">সুপার অ্যাডমিন</option>
                </select>
              </div>
              <div>
                <label className="label">স্ট্যাটাস</label>
                <select className="input" value={form.status} onChange={update('status')}>
                  <option value="active">সক্রিয়</option>
                  <option value="suspended">স্থগিত</option>
                </select>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            {form.role === 'super_admin'
              ? 'সুপার অ্যাডমিন সব ফিচার এবং এই ইউজার ম্যানেজমেন্ট ব্যবহার করতে পারবে।'
              : 'সাবস্ক্রাইবার রেপার্টরি, ম্যাটেরিয়া মেডিকা ও বিশ্লেষণ ব্যবহার করতে পারবে — সেভ/এডিট/ডিলিট বা রোগীর তথ্য নয়।'}
          </p>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'তৈরি হচ্ছে…' : 'ইউজার তৈরি করুন'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
              className="btn btn-ghost"
              disabled={saving}
            >
              বাতিল
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500 leading-relaxed">
        সাবস্ক্রাইবার রেপার্টরি, ম্যাটেরিয়া মেডিকা ও বিশ্লেষণ ব্যবহার করতে পারে — কিন্তু কোনো তথ্য
        সেভ, এডিট বা ডিলিট করতে পারে না এবং রোগী/কেস দেখতে পায় না। রোল বা স্ট্যাটাস বদলালে
        ইউজারকে পেজ রিলোড বা আবার লগইন করতে হবে। নিজের অ্যাকাউন্টের রোল/স্ট্যাটাস বদলানো বা
        অ্যাক্সেস বাতিল করা যায় না।
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="section-title">ইউজার তালিকা ({users.length})</h3>
          <button onClick={loadUsers} className="btn btn-ghost btn-sm">
            ↻ রিফ্রেশ
          </button>
        </div>

        {loading ? (
          <div className="card py-8 text-center text-sm text-slate-400">লোড হচ্ছে…</div>
        ) : users.length === 0 ? (
          <div className="card py-8 text-center text-sm text-slate-400">কোনো ইউজার নেই।</div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const isMe = u.id === user?.uid;
              const isActive = u.status === 'active';
              const busy = busyId === u.id;
              return (
                <div
                  key={u.id}
                  className={`card p-3.5 flex flex-wrap items-center gap-3 ${busy ? 'opacity-60' : ''}`}
                >
                  <div className="flex-1 min-w-[14rem]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {u.name || (u.email ? u.email.split('@')[0] : 'নাম নেই')}
                      </span>
                      {isMe && (
                        <span className="badge border-teal-200 bg-teal-50 text-teal-700">আপনি</span>
                      )}
                      <span
                        className={`badge ${
                          isActive
                            ? 'border-teal-200 bg-teal-50 text-teal-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {isActive ? 'সক্রিয়' : 'স্থগিত'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">{u.email || 'ইমেইল নেই'}</div>
                    {u.created_at && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        তৈরি: {formatDateBD(u.created_at)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-40">
                      <select
                        className="input"
                        value={u.role || 'subscriber'}
                        onChange={(e) => changeRole(u, e.target.value)}
                        disabled={isMe || busy}
                        title={isMe ? 'নিজের রোল বদলানো যাবে না' : 'রোল'}
                      >
                        <option value="subscriber">সাবস্ক্রাইবার</option>
                        <option value="super_admin">সুপার অ্যাডমিন</option>
                      </select>
                    </div>
                    <button
                      onClick={() => toggleStatus(u)}
                      disabled={isMe || busy}
                      className={`btn btn-sm ${
                        isActive
                          ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'btn-primary'
                      }`}
                    >
                      {isActive ? 'স্থগিত করুন' : 'সক্রিয় করুন'}
                    </button>
                    <button
                      onClick={() => removeAccess(u)}
                      disabled={isMe || busy}
                      className="btn btn-sm border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      অ্যাক্সেস বাতিল
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
