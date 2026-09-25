import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api.js';

const input = 'input';
const label = 'label';
const EMPTY_FORM = { section: '', rubric_text: '' };

// নতুন/সম্পাদনা রুব্রিক ফর্ম (একই ফর্ম দুই জায়গায়)
function RubricForm({ initial, sections, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial);
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-soft"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>শাখা (section) *</label>
          <input
            className={input}
            name="section"
            list="rubric-sections"
            value={form.section || ''}
            onChange={onChange}
            required
            placeholder="যেমন: মাথা"
          />
          <datalist id="rubric-sections">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={label}>রুব্রিকের টেক্সট *</label>
          <input
            className={input}
            name="rubric_text"
            value={form.rubric_text || ''}
            onChange={onChange}
            required
            placeholder="যেমন: কপালে ব্যথা"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          বাতিল
        </button>
      </div>
    </form>
  );
}

export default function Repertory() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sections, setSections] = useState([]);
  const [section, setSection] = useState('');
  const [rubrics, setRubrics] = useState([]);
  const [query, setQuery] = useState('');

  const [selected, setSelected] = useState([]); // নির্বাচিত রুব্রিক id
  const [open, setOpen] = useState(null);
  const [remedies, setRemedies] = useState([]);
  const [focusId, setFocusId] = useState(null); // ম্যাটেরিয়া মেডিকা থেকে আসা ফোকাস রুব্রিক
  const focusApplied = useRef(false);

  // ব্যবস্থাপনা (যোগ/সম্পাদনা/মুছুন + ওষুধ লিংক)
  const [notice, setNotice] = useState(null); // { text, ok }
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [allRemedies, setAllRemedies] = useState([]); // ওষুধ-পিকারের জন্য
  const [pickRemedyId, setPickRemedyId] = useState('');
  const [pickGrade, setPickGrade] = useState(1);
  const [showRemedyPicker, setShowRemedyPicker] = useState(false);

  const loadSections = () => api.getSections().then(setSections).catch(() => {});
  const loadRubrics = () =>
    api.getRubrics(section).then(setRubrics).catch(() => {});

  useEffect(() => {
    loadSections();
    api.getRemedies().then(setAllRemedies).catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    api.getRubrics(section)
      .then((data) => { if (active) setRubrics(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [section]);

  // ম্যাটেরিয়া মেডিকা থেকে পাঠানো ফোকাস রুব্রিক গ্রহণ
  useEffect(() => {
    const st = location.state;
    if (st?.focusRubricId) {
      focusApplied.current = false;
      setFocusId(st.focusRubricId);
      setSection(st.section || '');
    }
  }, [location.state]);

  // রুব্রিক লোড হলে ফোকাস রুব্রিক নির্বাচন + খোলা + স্ক্রল
  useEffect(() => {
    if (!focusId || focusApplied.current) return;
    if (!rubrics.some((r) => r.id === focusId)) return;
    focusApplied.current = true;
    setSelected((s) => (s.includes(focusId) ? s : [...s, focusId]));
    openRubric(focusId);
    document.getElementById(`rubric-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, rubrics]);

  // সার্চ অনুযায়ী ফিল্টার
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rubrics;
    return rubrics.filter((r) => r.rubric_text.toLowerCase().includes(q));
  }, [rubrics, query]);

  // শাখা অনুযায়ী গ্রুপ
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      if (!map.has(r.section)) map.set(r.section, []);
      map.get(r.section).push(r);
    }
    return [...map.entries()];
  }, [filtered]);

  const toggleSelect = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // রুব্রিক খোলা/বন্ধ + তার ওষুধ লোড
  const openRubric = async (id) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    setNotice(null);
    setShowRemedyPicker(false);
    setPickRemedyId('');
    setPickGrade(1);
    setRemedies(await api.getRubricRemedies(id));
  };

  const refreshRemedies = async (id) => {
    try {
      setRemedies(await api.getRubricRemedies(id));
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  const goToAnalysis = () => navigate('/analysis', { state: { rubricIds: selected } });

  // নতুন রুব্রিক যোগ
  const submitAdd = async (form) => {
    setNotice(null);
    try {
      const created = await api.addRubric(form);
      setShowAddForm(false);
      await Promise.all([loadSections(), loadRubrics()]);
      setNotice({ text: `"${created.rubric_text}" রুব্রিক যোগ করা হয়েছে`, ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // রুব্রিক সম্পাদনা
  const submitEdit = async (id, form) => {
    setNotice(null);
    try {
      await api.updateRubric(id, form);
      setEditingId(null);
      await Promise.all([loadSections(), loadRubrics()]);
      setNotice({ text: 'সম্পাদনা সংরক্ষিত হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // কাস্টম রুব্রিক মুছে ফেলা
  const removeRubric = async (r) => {
    if (!confirm(`"${r.rubric_text}" মুছে ফেলবেন? এর সব ওষুধ-লিংকও মুছে যাবে।`)) return;
    setNotice(null);
    try {
      await api.deleteRubric(r.id);
      if (open === r.id) setOpen(null);
      setSelected((s) => s.filter((x) => x !== r.id));
      await Promise.all([loadSections(), loadRubrics()]);
      setNotice({ text: 'রুব্রিক মুছে ফেলা হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // রুব্রিকে ওষুধ যোগ
  const addRemedyToRubric = async (rubricId) => {
    if (!pickRemedyId) return;
    setNotice(null);
    try {
      await api.addRubricRemedy(rubricId, Number(pickRemedyId), Number(pickGrade));
      await refreshRemedies(rubricId);
      setPickRemedyId('');
      setPickGrade(1);
      setShowRemedyPicker(false);
      setNotice({ text: 'ওষুধ যুক্ত হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // লিংকের গ্রেড পরিবর্তন
  const changeGrade = async (rubricId, remedyId, grade) => {
    setNotice(null);
    try {
      await api.updateRubricRemedyGrade(rubricId, remedyId, Number(grade));
      await refreshRemedies(rubricId);
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // ওষুধ-লিংক মুছে ফেলা
  const removeRemedyLink = async (rubricId, m) => {
    if (!confirm(`"${m.name}" লিংক মুছে ফেলবেন?`)) return;
    setNotice(null);
    try {
      await api.deleteRubricRemedy(rubricId, m.id);
      await refreshRemedies(rubricId);
      setNotice({ text: 'ওষুধ লিংক মুছে ফেলা হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // ওষুধ-পিকারে ইতিমধ্যে যুক্ত ওষুধ বাদ দিই
  const linkableRemedies = useMemo(() => {
    const linked = new Set(remedies.map((m) => m.id));
    return allRemedies.filter((r) => !linked.has(r.id));
  }, [allRemedies, remedies]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="page-title">রেপার্টরি</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAddForm((v) => !v); setNotice(null); }}
            className="btn btn-ghost"
          >
            {showAddForm ? '✕ বন্ধ করুন' : '＋ নতুন রুব্রিক'}
          </button>
          <button
            onClick={goToAnalysis}
            disabled={selected.length === 0}
            className="btn btn-primary"
          >
            বিশ্লেষণে পাঠান ({selected.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className={`text-sm px-3 py-2 rounded-lg border ${notice.ok ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
          {notice.text}
        </div>
      )}

      {showAddForm && (
        <RubricForm
          initial={EMPTY_FORM}
          sections={sections}
          onSubmit={submitAdd}
          onCancel={() => setShowAddForm(false)}
          submitLabel="যোগ করুন"
        />
      )}

      <input
        className="input max-w-sm"
        placeholder="🔍 রুব্রিক খুঁজুন..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSection('')}
          className={`px-3 py-1 rounded-full text-sm border transition ${!section ? 'bg-teal-600 text-white border-teal-600 shadow-soft' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        >
          সব
        </button>
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-3 py-1 rounded-full text-sm border transition ${section === s ? 'bg-teal-600 text-white border-teal-600 shadow-soft' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          নির্বাচিত: {selected.length}টি রুব্রিক
          <button onClick={() => setSelected([])} className="ml-2 underline hover:text-teal-800">মুছুন</button>
        </div>
      )}

      {grouped.map(([sec, items]) => (
        <div key={sec} className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 rounded-t-xl section-title text-slate-700">{sec}</div>
          <div className="divide-y divide-slate-100">
            {items.map((r) => (
              <div key={r.id} id={`rubric-${r.id}`} className="px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                {editingId === r.id ? (
                  <RubricForm
                    initial={{ section: r.section, rubric_text: r.rubric_text }}
                    sections={sections}
                    onSubmit={(form) => submitEdit(r.id, form)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="সংরক্ষণ করুন"
                  />
                ) : (
                  <>
                    <div
                      className={`flex items-start gap-2 rounded-md ${
                        r.id === focusId ? 'bg-teal-50 -mx-4 px-4 py-1 ring-1 ring-inset ring-teal-400' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 accent-teal-600"
                        checked={selected.includes(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        title="বিশ্লেষণের জন্য নির্বাচন"
                      />
                      <button
                        onClick={() => openRubric(r.id)}
                        className="flex-1 text-left text-sm font-medium text-slate-700 hover:text-teal-700 flex justify-between items-center gap-2"
                      >
                        <span>
                          {r.rubric_text}
                          {!!r.is_custom && (
                            <span className="badge ml-2 border-amber-200 bg-amber-50 text-amber-700 align-middle">
                              নিজের যোগ করা
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400 ml-2 shrink-0">{open === r.id ? '−' : '+'}</span>
                      </button>
                      <button
                        onClick={() => { setEditingId(r.id); setNotice(null); }}
                        title="রুব্রিক সম্পাদনা"
                        className="text-xs text-slate-400 hover:text-teal-600 px-1 mt-1"
                      >
                        ✎
                      </button>
                      {!!r.is_custom && (
                        <button
                          onClick={() => removeRubric(r)}
                          title="রুব্রিক মুছুন"
                          className="text-xs text-slate-400 hover:text-red-500 px-1 mt-1"
                        >
                          🗑
                        </button>
                      )}
                    </div>

                    {open === r.id && (
                      <div className="basis-full pt-2 pl-6 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {remedies.map((m) => (
                            <span
                              key={m.id}
                              className="chip border-amber-200 bg-amber-50 text-amber-800 group shadow-soft"
                            >
                              <button
                                onClick={() => navigate('/materia', { state: { focusRemedyId: m.id } })}
                                title="ম্যাটেরিয়া মেডিকায় এই ওষুধ দেখুন"
                                className="font-medium text-amber-800 hover:underline"
                              >
                                {m.name} ↗
                              </button>
                              <select
                                className="text-xs border border-amber-200 rounded px-1 py-0.5 text-slate-500 bg-white"
                                value={m.grade}
                                title="গ্রেড পরিবর্তন"
                                onChange={(e) => changeGrade(r.id, m.id, e.target.value)}
                              >
                                <option value={1}>১</option>
                                <option value={2}>২</option>
                                <option value={3}>৩</option>
                              </select>
                              <button
                                onClick={() => removeRemedyLink(r.id, m)}
                                title="এই ওষুধ-লিংক মুছুন"
                                className="text-xs text-amber-300 hover:text-red-500 px-0.5"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                          {remedies.length === 0 && (
                            <span className="text-sm text-slate-400">কোনো ওষুধ নেই</span>
                          )}
                        </div>

                        <div>
                          <button
                            onClick={() => { setShowRemedyPicker((v) => !v); setNotice(null); }}
                            className="btn btn-sm border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                          >
                            {showRemedyPicker ? '✕ বন্ধ' : '＋ ওষুধ যোগ'}
                          </button>

                          {showRemedyPicker && (
                            <div className="mt-2 bg-slate-50 rounded-lg border border-slate-200 p-3 flex flex-wrap gap-2 items-end">
                              <div className="flex-1 min-w-[12rem]">
                                <label className={label}>ওষুধ</label>
                                <select
                                  className={input}
                                  value={pickRemedyId}
                                  onChange={(e) => setPickRemedyId(e.target.value)}
                                >
                                  <option value="">বেছে নিন…</option>
                                  {linkableRemedies.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="w-20">
                                <label className={label}>গ্রেড</label>
                                <select
                                  className={input}
                                  value={pickGrade}
                                  onChange={(e) => setPickGrade(e.target.value)}
                                >
                                  <option value={1}>১</option>
                                  <option value={2}>২</option>
                                  <option value={3}>৩</option>
                                </select>
                              </div>
                              <button
                                onClick={() => addRemedyToRubric(r.id)}
                                disabled={!pickRemedyId}
                                className="btn btn-primary btn-sm"
                              >
                                যোগ
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && <div className="card py-8 text-center text-sm text-slate-400">কোনো রুব্রিক পাওয়া যায়নি।</div>}
    </div>
  );
}
