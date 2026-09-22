import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api.js';

// গ্রেড দেখানোর জন্য তিনটি বিন্দু (● ● ●)
function GradeDots({ grade }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`গ্রেড ${grade}`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`w-1.5 h-1.5 rounded-full ${n <= grade ? 'bg-teal-600' : 'bg-gray-300'}`}
        />
      ))}
    </span>
  );
}

// কমা-আলাদা তালিকা থেকে ছোট চিপ বানাই
function Chips({ text, tone }) {
  if (!text) return null;
  const items = text.split(',').map((s) => s.trim()).filter(Boolean);
  const toneClass =
    tone === 'good'
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-red-50 text-red-700 border-red-200';
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it, i) => (
        <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${toneClass}`}>
          {it}
        </span>
      ))}
    </div>
  );
}

const input = 'border rounded-md px-3 py-2 w-full text-sm';
const label = 'block text-xs font-medium text-gray-600 mb-1';
const EMPTY_FORM = { name: '', source: '', keynotes: '', clinical: '', better: '', worse: '' };

// নতুন/সম্পাদনা ফর্ম (একই ফর্ম দুই জায়গায় ব্যবহৃত)
function RemedyForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial);
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-3 bg-gray-50 rounded-lg border p-4"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>ওষুধের নাম *</label>
          <input className={input} name="name" value={form.name || ''} onChange={onChange} required placeholder="যেমন: Berberis vulgaris" />
        </div>
        <div>
          <label className={label}>উৎস (ল্যাটিন নাম)</label>
          <input className={input} name="source" value={form.source || ''} onChange={onChange} placeholder="যেমন: Berberis vulgaris" />
        </div>
      </div>
      <div>
        <label className={label}>কী-নোট</label>
        <textarea className={input} name="keynotes" rows={2} value={form.keynotes || ''} onChange={onChange} placeholder="মূল লক্ষণসমূহ" />
      </div>
      <div>
        <label className={label}>ক্লিনিক্যাল ব্যবহার</label>
        <input className={input} name="clinical" value={form.clinical || ''} onChange={onChange} placeholder="কিসে ব্যবহার (কমা দিয়ে আলাদা)" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>কীতে ভালো</label>
          <input className={input} name="better" value={form.better || ''} onChange={onChange} placeholder="মোডালিটি (কমা দিয়ে আলাদা)" />
        </div>
        <div>
          <label className={label}>কীতে বাড়ে</label>
          <input className={input} name="worse" value={form.worse || ''} onChange={onChange} placeholder="মোডালিটি (কমা দিয়ে আলাদা)" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="bg-teal-600 text-white rounded-md px-4 py-2 text-sm hover:bg-teal-700">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="bg-white border rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
          বাতিল
        </button>
      </div>
    </form>
  );
}

export default function MateriaMedica() {
  const navigate = useNavigate();
  const location = useLocation();
  const [remedies, setRemedies] = useState([]);
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState('সব');
  const [selected, setSelected] = useState(null); // নির্বাচিত ওষুধ
  const [profile, setProfile] = useState(null); // নির্বাচিত ওষুধের রুব্রিক-প্রোফাইল
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [msg, setMsg] = useState('');
  const [notice, setNotice] = useState(null); // { text, ok } — ফর্ম/লিংক অপারেশনের বার্তা
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [sections, setSections] = useState([]);
  const [linkSection, setLinkSection] = useState('');
  const [sectionRubrics, setSectionRubrics] = useState([]);
  const [linkRubricId, setLinkRubricId] = useState('');
  const [linkGrade, setLinkGrade] = useState(1);
  const focusApplied = useRef(null);

  const loadRemedies = () => api.getRemedies().then(setRemedies).catch((e) => setMsg(e.message));

  useEffect(() => {
    loadRemedies();
    api.getSections().then(setSections).catch(() => {});
  }, []);

  // রেপার্টরি থেকে পাঠানো ফোকাস ওষুধ খুলে দেখাও
  useEffect(() => {
    const st = location.state;
    if (!st?.focusRemedyId || remedies.length === 0) return;
    if (focusApplied.current === st.focusRemedyId) return;
    const r = remedies.find((x) => x.id === st.focusRemedyId);
    if (!r) return;
    focusApplied.current = st.focusRemedyId;
    setLetter(r.name[0].toUpperCase());
    openRemedy(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, remedies]);

  // উপলব্ধ বর্ণমালা (ওষুধের নামের প্রথম অক্ষর)
  const letters = useMemo(() => {
    const set = new Set(remedies.map((r) => r.name[0].toUpperCase()));
    return [...set].sort();
  }, [remedies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return remedies.filter((r) => {
      const matchesLetter = letter === 'সব' || r.name[0].toUpperCase() === letter;
      const matchesQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.source || '').toLowerCase().includes(q) ||
        (r.keynotes || '').toLowerCase().includes(q);
      return matchesLetter && matchesQuery;
    });
  }, [remedies, query, letter]);

  // ওষুধের রুব্রিকগুলো সেকশন অনুযায়ী গোছানো
  const grouped = useMemo(() => {
    if (!profile) return [];
    const map = new Map();
    for (const row of profile) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section).push(row);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [profile]);

  const openRemedy = async (r) => {
    setSelected(r);
    setMsg('');
    setNotice(null);
    setEditing(false);
    setShowLinkPicker(false);
    setLoadingProfile(true);
    setProfile(null);
    try {
      setProfile(await api.getRemedyRubrics(r.id));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoadingProfile(false);
    }
  };

  const refreshProfile = async (remedyId) => {
    try {
      setProfile(await api.getRemedyRubrics(remedyId));
    } catch (e) {
      setMsg(e.message);
    }
  };

  // নতুন ওষুধ যোগ
  const submitAdd = async (form) => {
    setNotice(null);
    try {
      const created = await api.addRemedy(form);
      await loadRemedies();
      setShowAddForm(false);
      openRemedy(created);
      setNotice({ text: `"${created.name}" যোগ করা হয়েছে`, ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // ওষুধ সম্পাদনা
  const submitEdit = async (form) => {
    setNotice(null);
    try {
      const updated = await api.updateRemedy(selected.id, form);
      await loadRemedies();
      setSelected(updated);
      setEditing(false);
      setNotice({ text: 'সম্পাদনা সংরক্ষিত হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // কাস্টম ওষুধ মুছে ফেলা
  const removeRemedy = async () => {
    if (!confirm(`"${selected.name}" মুছে ফেলবেন? এর সব রুব্রিক-লিংকও মুছে যাবে।`)) return;
    setNotice(null);
    try {
      await api.deleteRemedy(selected.id);
      setSelected(null);
      setProfile(null);
      await loadRemedies();
      setNotice({ text: 'ওষুধ মুছে ফেলা হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // লিংকের গ্রেড পরিবর্তন
  const changeGrade = async (row, grade) => {
    setNotice(null);
    try {
      await api.updateRemedyRubricGrade(selected.id, row.id, Number(grade));
      await refreshProfile(selected.id);
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // রুব্রিক লিংক মুছে ফেলা
  const removeLink = async (row) => {
    if (!confirm(`"${row.rubric_text}" লিংক মুছে ফেলবেন?`)) return;
    setNotice(null);
    try {
      await api.deleteRemedyRubric(selected.id, row.id);
      await refreshProfile(selected.id);
      setNotice({ text: 'রুব্রিক লিংক মুছে ফেলা হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // সেকশন বেছে নিলে সেই সেকশনের রুব্রিক লোড
  const onPickSection = (section) => {
    setLinkSection(section);
    setLinkRubricId('');
    setSectionRubrics([]);
    if (!section) return;
    api.getRubrics(section).then(setSectionRubrics).catch((e) => setNotice({ text: e.message, ok: false }));
  };

  // নতুন রুব্রিক লিংক যোগ
  const addLink = async () => {
    if (!linkRubricId) return;
    setNotice(null);
    try {
      await api.addRemedyRubric(selected.id, Number(linkRubricId), Number(linkGrade));
      await refreshProfile(selected.id);
      setLinkRubricId('');
      setLinkGrade(1);
      setShowLinkPicker(false);
      setNotice({ text: 'রুব্রিক যুক্ত হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // রেপার্টরিতে গিয়ে এই রুব্রিকে ফোকাস করি
  const focusRubric = (row) =>
    navigate('/repertory', { state: { focusRubricId: row.id, section: row.section } });

  // লিংক-পিকারে ইতিমধ্যে যুক্ত রুব্রিক বাদ দিই
  const linkableRubrics = useMemo(() => {
    if (!sectionRubrics.length) return [];
    const linked = new Set((profile || []).map((p) => p.id));
    return sectionRubrics.filter((r) => !linked.has(r.id));
  }, [sectionRubrics, profile]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">ম্যাটেরিয়া মেডিকা</h2>
          <p className="text-sm text-gray-500">
            ওষুধ বেছে নিয়ে তার কী-নোট ও রেপার্টরি প্রোফাইল দেখুন — নিজের বিচারে নতুন ওষুধও যোগ করতে পারবেন।
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm((v) => !v); setNotice(null); }}
          className="bg-teal-600 text-white rounded-md px-4 py-2 text-sm hover:bg-teal-700"
        >
          {showAddForm ? '✕ বন্ধ করুন' : '＋ নতুন ওষুধ যোগ করুন'}
        </button>
      </div>

      {msg && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{msg}</div>}
      {notice && (
        <div className={`text-sm px-3 py-2 rounded ${notice.ok ? 'text-teal-700 bg-teal-50' : 'text-red-600 bg-red-50'}`}>
          {notice.text}
        </div>
      )}

      {showAddForm && (
        <RemedyForm
          initial={EMPTY_FORM}
          onSubmit={submitAdd}
          onCancel={() => setShowAddForm(false)}
          submitLabel="যোগ করুন"
        />
      )}

      <input
        className="border rounded-md px-3 py-2 w-full max-w-md"
        placeholder="🔍 ওষুধ খুঁজুন (নাম, উৎস বা কী-নোট)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* বর্ণমালা ইনডেক্স */}
      <div className="flex flex-wrap gap-1">
        {['সব', ...letters].map((L) => (
          <button
            key={L}
            onClick={() => setLetter(L)}
            className={`px-2 py-1 rounded text-xs font-medium border ${
              letter === L
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {L}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* ওষুধের তালিকা */}
        <div className="md:col-span-1 bg-white rounded-xl shadow p-2 max-h-[32rem] overflow-auto">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => openRemedy(r)}
              className={`w-full text-left px-3 py-2 rounded-lg ${
                selected?.id === r.id ? 'bg-teal-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`font-semibold ${selected?.id === r.id ? 'text-teal-700' : 'text-gray-800'}`}>
                {r.name}
                {!!r.is_custom && (
                  <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 align-middle">
                    নিজের যোগ করা
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 italic">{r.source}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-gray-400 p-3">কিছু পাওয়া যায়নি।</div>
          )}
        </div>

        {/* বিস্তারিত প্রোফাইল */}
        <div className="md:col-span-2">
          {!selected && (
            <div className="bg-white rounded-xl shadow p-6 text-gray-400 text-sm h-full flex items-center justify-center">
              ← বাম পাশ থেকে একটি ওষুধ নির্বাচন করুন
            </div>
          )}

          {selected && editing && (
            <div className="bg-white rounded-xl shadow p-5 space-y-3">
              <h3 className="text-lg font-bold text-gray-800">সম্পাদনা: {selected.name}</h3>
              <RemedyForm
                initial={{
                  name: selected.name,
                  source: selected.source || '',
                  keynotes: selected.keynotes || '',
                  clinical: selected.clinical || '',
                  better: selected.better || '',
                  worse: selected.worse || '',
                }}
                onSubmit={submitEdit}
                onCancel={() => setEditing(false)}
                submitLabel="সংরক্ষণ করুন"
              />
            </div>
          )}

          {selected && !editing && (
            <div className="bg-white rounded-xl shadow p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold text-teal-700">
                    {selected.name}
                    {!!selected.is_custom && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 align-middle">
                        নিজের যোগ করা
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 italic">উৎস: {selected.source}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(true); setNotice(null); }}
                    className="text-sm bg-white border rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                  >
                    ✎ সম্পাদনা
                  </button>
                  {!!selected.is_custom && (
                    <button
                      onClick={removeRemedy}
                      className="text-sm bg-white border border-red-200 rounded-md px-3 py-1.5 text-red-600 hover:bg-red-50"
                    >
                      🗑 মুছুন
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-teal-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-teal-700 mb-1">কী-নোট</div>
                <p className="text-sm text-gray-700">{selected.keynotes || '—'}</p>
              </div>

              {selected.clinical && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs font-semibold text-blue-700 mb-1">ক্লিনিক্যাল ব্যবহার</div>
                  <p className="text-sm text-gray-700">{selected.clinical}</p>
                </div>
              )}

              {(selected.better || selected.worse) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-green-200 p-3">
                    <div className="text-xs font-semibold text-green-700 mb-2">কীতে ভালো (মোডালিটি)</div>
                    <Chips text={selected.better} tone="good" />
                  </div>
                  <div className="rounded-lg border border-red-200 p-3">
                    <div className="text-xs font-semibold text-red-700 mb-2">কীতে বাড়ে (মোডালিটি)</div>
                    <Chips text={selected.worse} tone="bad" />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-800">রেপার্টরি প্রোফাইল</h4>
                  <div className="flex items-center gap-3">
                    {profile && (
                      <span className="text-xs text-gray-400">
                        {profile.length} রুব্রিকে আছে · গ্রেড <GradeDots grade={3} /> = শক্তিশালী
                      </span>
                    )}
                    <button
                      onClick={() => setShowLinkPicker((v) => !v)}
                      className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-1 hover:bg-teal-100"
                    >
                      {showLinkPicker ? '✕ বন্ধ' : '＋ রুব্রিক যোগ'}
                    </button>
                  </div>
                </div>

                {showLinkPicker && (
                  <div className="bg-gray-50 rounded-lg border p-3 mb-3 grid sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <label className={label}>সেকশন</label>
                      <select className={input} value={linkSection} onChange={(e) => onPickSection(e.target.value)}>
                        <option value="">বেছে নিন…</option>
                        {sections.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>রুব্রিক</label>
                      <select className={input} value={linkRubricId} onChange={(e) => setLinkRubricId(e.target.value)} disabled={!linkSection}>
                        <option value="">বেছে নিন…</option>
                        {linkableRubrics.map((r) => (
                          <option key={r.id} value={r.id}>{r.rubric_text}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div>
                        <label className={label}>গ্রেড</label>
                        <select className={input} value={linkGrade} onChange={(e) => setLinkGrade(e.target.value)}>
                          <option value={1}>১</option>
                          <option value={2}>২</option>
                          <option value={3}>৩</option>
                        </select>
                      </div>
                      <button
                        onClick={addLink}
                        disabled={!linkRubricId}
                        className="bg-teal-600 text-white rounded-md px-3 py-2 text-sm hover:bg-teal-700 disabled:opacity-50"
                      >
                        যোগ
                      </button>
                    </div>
                  </div>
                )}

                {loadingProfile && <div className="text-sm text-gray-400">লোড হচ্ছে…</div>}

                {!loadingProfile && grouped.length === 0 && profile && (
                  <div className="text-sm text-gray-400">
                    এই ওষুধটির জন্য কোনো রুব্রিক লিংক নেই — উপরের "＋ রুব্রিক যোগ" থেকে যুক্ত করুন।
                  </div>
                )}

                <div className="space-y-3">
                  {grouped.map(([section, rows]) => (
                    <div key={section}>
                      <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                        {section}
                      </div>
                      <ul className="space-y-1">
                        {rows.map((row, i) => (
                          <li key={i} className="flex items-center gap-1 group">
                            <button
                              onClick={() => focusRubric(row)}
                              title="রেপার্টরিতে এই রুব্রিক দেখুন"
                              className="flex-1 text-left flex items-center gap-2 text-sm text-gray-700 px-2 py-1 rounded hover:bg-teal-50 hover:text-teal-700"
                            >
                              <GradeDots grade={row.grade} />
                              <span className="flex-1">{row.rubric_text}</span>
                              <span className="text-gray-300">↗</span>
                            </button>
                            <select
                              className="text-xs border rounded px-1 py-0.5 text-gray-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
                              value={row.grade}
                              title="গ্রেড পরিবর্তন"
                              onChange={(e) => changeGrade(row, e.target.value)}
                            >
                              <option value={1}>১</option>
                              <option value={2}>২</option>
                              <option value={3}>৩</option>
                            </select>
                            <button
                              onClick={() => removeLink(row)}
                              title="এই রুব্রিক লিংক মুছুন"
                              className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 px-1"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
