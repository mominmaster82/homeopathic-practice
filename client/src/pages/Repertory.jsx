import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { suggestRemediesForRubric } from '../utils/linkSuggest.js';
import { searchRubrics, searchRemedies, highlightSegments } from '../utils/search.js';

const input = 'input';
const label = 'label';
const EMPTY_FORM = { section: '', rubric_text: '' };

// সার্চে মিলে যাওয়া অংশটা হাইলাইট করে
function HighlightedText({ text, words }) {
  return highlightSegments(text, words).map((part, i) =>
    part.hit ? (
      <mark key={i} className="rounded bg-amber-100 px-0.5 text-inherit">{part.text}</mark>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );
}

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
  const { isAdmin } = useAuth();
  const [sections, setSections] = useState([]);
  const [section, setSection] = useState('');
  const [rubrics, setRubrics] = useState([]);
  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [customOnly, setCustomOnly] = useState(
    () => localStorage.getItem('repertory-custom-only') === '1'
  );

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
  const [pickQuery, setPickQuery] = useState('');
  const [pickRemedyId, setPickRemedyId] = useState('');
  const [pickGrade, setPickGrade] = useState(1);
  const [showRemedyPicker, setShowRemedyPicker] = useState(false);
  const [suggestions, setSuggestions] = useState(null); // খোলা রুব্রিকের প্রস্তাবিত ওষুধ
  const [suggestGrades, setSuggestGrades] = useState({});

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
  useEffect(() => {
    localStorage.setItem('repertory-custom-only', customOnly ? '1' : '0');
  }, [customOnly]);

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

  // সার্চ — হুবহু না মিললেও কাণ্ড-শব্দ মিলিয়ে সাজানো ফলাফল
  const customCount = useMemo(() => rubrics.filter((r) => !!r.is_custom).length, [rubrics]);
  const rubricPool = useMemo(
    () => (customOnly ? rubrics.filter((r) => !!r.is_custom) : rubrics),
    [rubrics, customOnly]
  );
  const search = useMemo(() => searchRubrics(rubricPool, query), [rubricPool, query]);
  const filtered = search.items;
  const topSuggestions = useMemo(
    () => (query.trim() ? filtered.slice(0, 8) : []),
    [filtered, query]
  );

  // শাখা অনুযায়ী গ্রুপ
  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of filtered) {
      const { section: sec } = item.rubric;
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec).push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  const toggleSelect = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleCustomOnly = () => {
    const next = !customOnly;
    setCustomOnly(next);
    if (next && section) setSection(''); // সব শাখার নিজের রুব্রিক দেখাই
  };

  // রুব্রিক খোলা/বন্ধ + তার ওষুধ লোড
  const openRubric = async (id) => {
    setSuggestions(null);
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    setNotice(null);
    setShowRemedyPicker(false);
    setPickQuery('');
    setPickRemedyId('');
    setPickGrade(1);
    setRemedies([]);
    setRemedies(await api.getRubricRemedies(id));
  };

  // সাজেশন থেকে রুব্রিকে যাওয়া — রুব্রিকটি খুলে স্ক্রল করে দেখাই
  const revealRubric = (id) => {
    if (open !== id) openRubric(id);
    focusApplied.current = true;
    setFocusId(id);
    requestAnimationFrame(() => {
      document.getElementById(`rubric-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const pickSuggestion = (item) => {
    if (!item) return;
    setSuggestOpen(false);
    revealRubric(item.rubric.id);
  };

  const onSearchKeyDown = (e) => {
    if (e.key === 'Escape') { setSuggestOpen(false); return; }
    if (!topSuggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!suggestOpen) { setSuggestOpen(true); setSuggestIndex(0); }
      else setSuggestIndex((i) => (i + 1) % topSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!suggestOpen) { setSuggestOpen(true); setSuggestIndex(topSuggestions.length - 1); }
      else setSuggestIndex((i) => (i - 1 + topSuggestions.length) % topSuggestions.length);
    } else if (e.key === 'Enter' && suggestOpen) {
      e.preventDefault();
      pickSuggestion(topSuggestions[Math.min(suggestIndex, topSuggestions.length - 1)]);
    }
  };

  const refreshRemedies = async (id) => {
    try {
      setRemedies(await api.getRubricRemedies(id));
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  const goToAnalysis = () => navigate('/analysis', { state: { rubricIds: selected } });

  // নতুন রুব্রিক যোগ — যোগ করেই প্রস্তাবিত ওষুধ দেখাই
  const submitAdd = async (form) => {
    setNotice(null);
    try {
      const created = await api.addRubric(form);
      setShowAddForm(false);
      await loadSections();
      setSection(created.section);
      setQuery(created.rubric_text); // নতুন রুব্রিকটি যেন সাথে সাথেই চোখে পড়ে
      setRubrics(await api.getRubrics(created.section));
      setOpen(created.id);
      focusApplied.current = true;
      setFocusId(created.id);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(`rubric-${created.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      setRemedies([]);
      setShowRemedyPicker(false);
      setPickQuery('');
      setPickRemedyId('');
      setPickGrade(1);
      setNotice({ text: `"${created.rubric_text}" রুব্রিক যোগ করা হয়েছে — নিচে প্রস্তাবিত ওষুধ দেখুন`, ok: true });
      loadRemedySuggestions(created, []);
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
      setSuggestions(null); // টেক্সট বদলেছে — প্রস্তাব আবার খুঁজতে হবে
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
      setPickQuery('');
      setPickRemedyId('');
      setPickGrade(1);
      setShowRemedyPicker(false);
      setNotice({ text: 'ওষুধ যুক্ত হয়েছে', ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // প্রস্তাবিত ওষুধ — রুব্রিকের টেক্সটের সাথে কী-নোট/ক্লিনিক্যাল মিলিয়ে
  const loadRemedySuggestions = async (rubric, linkedRows = []) => {
    try {
      const pool = allRemedies.length ? allRemedies : await api.getRemedies();
      if (!allRemedies.length) setAllRemedies(pool);
      const list = suggestRemediesForRubric(rubric, pool, {
        excludeIds: (linkedRows || []).map((m) => m.id),
      });
      setSuggestions(list);
      setSuggestGrades(Object.fromEntries(list.map((s) => [s.remedy.id, 1])));
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  const toggleSuggestions = (rubric) => {
    if (suggestions) {
      setSuggestions(null);
      return;
    }
    setShowRemedyPicker(false);
    loadRemedySuggestions(rubric, remedies);
  };

  // মাঝপথে ম্যানুয়ালি লিংক করলে প্রস্তাব-তালিকা থেকেও সরে যায়
  const visibleSuggestions = useMemo(() => {
    if (!suggestions) return [];
    const linked = new Set(remedies.map((m) => m.id));
    return suggestions.filter((s) => !linked.has(s.remedy.id));
  }, [suggestions, remedies]);

  const addSuggestedRemedy = async (rubricId, s) => {
    setNotice(null);
    try {
      await api.addRubricRemedy(rubricId, s.remedy.id, Number(suggestGrades[s.remedy.id] || 1));
      await refreshRemedies(rubricId);
      setNotice({ text: `“${s.remedy.name}” যুক্ত হয়েছে`, ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  const addAllSuggestedRemedies = async (rubricId) => {
    if (visibleSuggestions.length === 0) return;
    if (!confirm(`${visibleSuggestions.length}টি ওষুধ যোগ করবেন? গ্রেডগুলো মিলিয়ে নিন।`)) return;
    setNotice(null);
    try {
      for (const s of visibleSuggestions) {
        await api.addRubricRemedy(rubricId, s.remedy.id, Number(suggestGrades[s.remedy.id] || 1));
      }
      await refreshRemedies(rubricId);
      setNotice({ text: `${visibleSuggestions.length}টি ওষুধ যুক্ত হয়েছে`, ok: true });
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

  // পিকারের সার্চ — নাম/উৎস/লক্ষণ মিলিয়ে
  const pickSearch = useMemo(
    () => searchRemedies(linkableRemedies, pickQuery),
    [linkableRemedies, pickQuery]
  );
  const pickOptions = pickQuery.trim() ? pickSearch.items.slice(0, 50) : pickSearch.items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="page-title">রেপার্টরি</h2>
        {isAdmin && (
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
        )}
      </div>

      {notice && (
        <div className={`text-sm px-3 py-2 rounded-lg border ${notice.ok ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
          {notice.text}
        </div>
      )}

      {isAdmin && showAddForm && (
        <RubricForm
          initial={EMPTY_FORM}
          sections={sections}
          onSubmit={submitAdd}
          onCancel={() => setShowAddForm(false)}
          submitLabel="যোগ করুন"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="relative w-full max-w-sm"
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSuggestOpen(false); }}
        >
          <input
            className="input"
            placeholder="🔍 রুব্রিক খুঁজুন..."
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              setSuggestIndex(0);
              setSuggestOpen(!!value.trim());
            }}
            onFocus={() => {
              if (query.trim()) { setSuggestIndex(0); setSuggestOpen(true); }
            }}
            onKeyDown={onSearchKeyDown}
            role="combobox"
            aria-expanded={suggestOpen && !!query.trim()}
            aria-controls="rubric-search-suggestions"
            aria-autocomplete="list"
          />
          {suggestOpen && query.trim() && (
            <div
              id="rubric-search-suggestions"
              className="absolute z-20 mt-1 w-full max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              {topSuggestions.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-400">কোনো রুব্রিক মেলেনি — বানান বদলে দেখুন।</div>
              ) : (
                <>
                  <div className="sticky top-0 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-400 border-b border-slate-100">
                    {search.partial ? 'কাছাকাছি রুব্রিক' : 'মিলে যাওয়া রুব্রিক'} · ↑↓ বেছে নিন, Enter খুলুন
                  </div>
                  <ul>
                    {topSuggestions.map((item, i) => (
                      <li key={item.rubric.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setSuggestIndex(i)}
                          onClick={() => pickSuggestion(item)}
                          className={`w-full px-3 py-2 text-left ${i === suggestIndex ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                        >
                          <span className="block text-sm text-slate-700">
                            <HighlightedText text={item.rubric.rubric_text} words={item.matchedWords} />
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {item.rubric.section}
                            {item.rubric.is_custom ? ' · নিজের যোগ করা' : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleCustomOnly}
          aria-pressed={customOnly}
          className={`px-3 py-1 rounded-full text-sm border transition ${
            customOnly
              ? 'bg-amber-500 text-white border-amber-500 shadow-soft'
              : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
          }`}
        >
          ✨ শুধু নিজের যোগ করা ({customCount})
        </button>
      </div>

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

      {isAdmin && selected.length > 0 && (
        <div className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          নির্বাচিত: {selected.length}টি রুব্রিক
          <button onClick={() => setSelected([])} className="ml-2 underline hover:text-teal-800">মুছুন</button>
        </div>
      )}

      {search.partial && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          সব শব্দ মেলেনি — কাছাকাছি রুব্রিক দেখানো হচ্ছে। কম শব্দ লিখে বা বানান বদলে আবার চেষ্টা করুন।
        </div>
      )}

      {grouped.map(([sec, items]) => (
        <div key={sec} className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 rounded-t-xl section-title text-slate-700">{sec}</div>
          <div className="divide-y divide-slate-100">
            {items.map(({ rubric: r, matchedWords }) => (
              <div key={r.id} id={`rubric-${r.id}`} className="px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                {isAdmin && editingId === r.id ? (
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
                      {isAdmin && (
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 accent-teal-600"
                          checked={selected.includes(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          title="বিশ্লেষণের জন্য নির্বাচন"
                        />
                      )}
                      <button
                        onClick={() => openRubric(r.id)}
                        className="flex-1 text-left text-sm font-medium text-slate-700 hover:text-teal-700 flex justify-between items-center gap-2"
                      >
                        <span>
                          <HighlightedText text={r.rubric_text} words={matchedWords} />
                          {!!r.is_custom && (
                            <span className="badge ml-2 border-amber-200 bg-amber-50 text-amber-700 align-middle">
                              নিজের যোগ করা
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400 ml-2 shrink-0">{open === r.id ? '−' : '+'}</span>
                      </button>
                      {isAdmin && (
                        <>
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
                        </>
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
                              {isAdmin ? (
                                <>
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
                                </>
                              ) : (
                                <span className="text-[11px] text-amber-700" title="গ্রেড">
                                  গ্রেড {m.grade}
                                </span>
                              )}
                            </span>
                          ))}
                          {remedies.length === 0 && (
                            <span className="text-sm text-slate-400">কোনো ওষুধ নেই</span>
                          )}
                        </div>

                        {isAdmin && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                if (showRemedyPicker) {
                                  setPickQuery('');
                                  setPickRemedyId('');
                                  setPickGrade(1);
                                }
                                setShowRemedyPicker((v) => !v);
                                setNotice(null);
                              }}
                              className="btn btn-sm border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                            >
                              {showRemedyPicker ? '✕ বন্ধ' : '＋ ওষুধ যোগ'}
                            </button>
                            <button
                              onClick={() => toggleSuggestions(r)}
                              className="btn btn-sm border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            >
                              {suggestions ? '✕ প্রস্তাব বন্ধ' : '✨ প্রস্তাবিত ওষুধ'}
                            </button>
                          </div>

                          {suggestions && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-amber-800">টেক্সট মিলিয়ে পাওয়া ওষুধ</div>
                                  <p className="text-xs text-amber-700/80">
                                    স্বয়ংক্রিয় প্রস্তাব — কী-নোট দেখে যাচাই করে যোগ করুন।
                                  </p>
                                </div>
                                {visibleSuggestions.length > 1 && (
                                  <button
                                    onClick={() => addAllSuggestedRemedies(r.id)}
                                    className="btn btn-sm border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                                  >
                                    সব যোগ করুন ({visibleSuggestions.length})
                                  </button>
                                )}
                              </div>

                              {visibleSuggestions.length === 0 ? (
                                <p className="text-sm text-amber-800/80 py-1">
                                  {suggestions.length === 0
                                    ? 'কোনো মিল পাওয়া যায়নি — "＋ ওষুধ যোগ" দিয়ে নিজে বেছে নিতে পারেন।'
                                    : 'সব প্রস্তাবিত ওষুধ ইতিমধ্যে যুক্ত হয়েছে।'}
                                </p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {visibleSuggestions.map((s) => (
                                    <li key={s.remedy.id} className="rounded-md border border-amber-100 bg-white px-2 py-1.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="flex-1 min-w-[8rem] text-sm text-slate-700">{s.remedy.name}</span>
                                        <button
                                          onClick={() => navigate('/materia', { state: { focusRemedyId: s.remedy.id } })}
                                          title="ম্যাটেরিয়া মেডিকায় এই ওষুধ দেখুন"
                                          className="text-xs text-amber-700 underline hover:text-amber-900"
                                        >
                                          বিস্তারিত ↗
                                        </button>
                                        <select
                                          className="text-xs border border-slate-200 rounded px-1 py-0.5 text-slate-600 bg-white"
                                          value={suggestGrades[s.remedy.id] || 1}
                                          title="গ্রেড"
                                          onChange={(e) =>
                                            setSuggestGrades((g) => ({ ...g, [s.remedy.id]: Number(e.target.value) }))
                                          }
                                        >
                                          <option value={1}>গ্রেড ১</option>
                                          <option value={2}>গ্রেড ২</option>
                                          <option value={3}>গ্রেড ৩</option>
                                        </select>
                                        <button
                                          onClick={() => addSuggestedRemedy(r.id, s)}
                                          className="btn btn-primary btn-sm"
                                        >
                                          যোগ
                                        </button>
                                      </div>
                                      {s.reasons.length > 0 && (
                                        <div className="text-xs text-amber-700/80 mt-0.5">{s.reasons.join(' · ')}</div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {showRemedyPicker && (
                            <div className="mt-2 bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2">
                              <div className="flex flex-wrap gap-2 items-end">
                                <div className="flex-1 min-w-[12rem]">
                                  <label className={label}>ওষুধ খুঁজুন</label>
                                  <input
                                    className={input}
                                    value={pickQuery}
                                    onChange={(e) => {
                                      setPickQuery(e.target.value);
                                      setPickRemedyId('');
                                    }}
                                    placeholder="নাম, উৎস বা লক্ষণ লিখুন"
                                    autoFocus
                                  />
                                </div>
                                <div className="flex-1 min-w-[12rem]">
                                  <label className={label}>ওষুধ</label>
                                  <select
                                    className={input}
                                    value={pickRemedyId}
                                    onChange={(e) => setPickRemedyId(e.target.value)}
                                    disabled={pickOptions.length === 0}
                                  >
                                    <option value="">
                                      {pickOptions.length === 0 ? 'কোনো ওষুধ মিলল না' : 'বেছে নিন…'}
                                    </option>
                                    {pickOptions.map(({ remedy: m }) => (
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
                              {pickQuery.trim() && (
                                <p className="text-xs text-slate-500">
                                  {pickSearch.items.length === 0
                                    ? 'এই লেখায় কোনো ওষুধ মেলেনি — অন্য শব্দ দিয়ে দেখুন।'
                                    : `${pickSearch.items.length}টি ওষুধ মিলেছে${pickSearch.partial ? ' (কাছাকাছি)' : ''}${pickSearch.items.length > 50 ? ' — প্রথম ৫০টি দেখানো হচ্ছে' : ''}`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="card py-8 text-center text-sm text-slate-400">
          {query.trim()
            ? `“${query.trim()}” — কোনো রুব্রিক পাওয়া যায়নি। বানান বদলে বা কম শব্দ লিখে দেখুন।`
            : customOnly
              ? 'নিজের যোগ করা কোনো রুব্রিক পাওয়া যায়নি — ফিল্টার বন্ধ করে দেখুন।'
              : 'কোনো রুব্রিক পাওয়া যায়নি।'}
        </div>
      )}
    </div>
  );
}
