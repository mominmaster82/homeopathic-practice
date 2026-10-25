import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { suggestRubricsForRemedy } from '../utils/linkSuggest.js';
import { searchRemedies } from '../utils/search.js';

// গ্রেড দেখানোর জন্য তিনটি বিন্দু (● ● ●)
function GradeDots({ grade }) {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" title={`গ্রেড ${grade}`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`w-1.5 h-1.5 rounded-full ${n <= grade ? 'bg-teal-600' : 'bg-slate-300'}`}
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
        <span key={i} className={`chip ${toneClass}`}>
          {it}
        </span>
      ))}
    </div>
  );
}

const input = 'input';
const label = 'label';
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
      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-soft"
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

export default function MateriaMedica() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [remedies, setRemedies] = useState([]);
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState('সব');
  const [customOnly, setCustomOnly] = useState(
    () => localStorage.getItem('materia-custom-only') === '1'
  );
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
  const [allRubrics, setAllRubrics] = useState(null); // প্রস্তাব তৈরির জন্য সব রুব্রিক
  const [suggestions, setSuggestions] = useState(null); // null = বন্ধ
  const [suggestGrades, setSuggestGrades] = useState({});
  const [suggestBusy, setSuggestBusy] = useState(false);
  const focusApplied = useRef(null);

  const loadRemedies = () => api.getRemedies().then(setRemedies).catch((e) => setMsg(e.message));

  useEffect(() => {
    loadRemedies();
    api.getSections().then(setSections).catch(() => {});
  }, []);
  useEffect(() => {
    localStorage.setItem('materia-custom-only', customOnly ? '1' : '0');
  }, [customOnly]);

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
    const source = customOnly ? remedies.filter((r) => !!r.is_custom) : remedies;
    const set = new Set(source.map((r) => r.name[0].toUpperCase()));
    return [...set].sort();
  }, [remedies, customOnly]);

  const customCount = useMemo(() => remedies.filter((r) => !!r.is_custom).length, [remedies]);

  // ফাজি সার্চ (নাম/উৎস/কী-নোট/ক্লিনিক্যাল/মোডালিটি), তারপর বর্ণ ফিল্টার
  const remedySearch = useMemo(() => {
    const pool = customOnly ? remedies.filter((r) => !!r.is_custom) : remedies;
    return searchRemedies(pool, query);
  }, [remedies, query, customOnly]);

  const filtered = useMemo(
    () =>
      remedySearch.items
        .map(({ remedy }) => remedy)
        .filter((r) => letter === 'সব' || (r.name || '')[0]?.toUpperCase() === letter),
    [remedySearch, letter]
  );

  const toggleCustomOnly = () => {
    const next = !customOnly;
    setCustomOnly(next);
    if (next) setLetter('সব');
  };

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
    setSuggestions(null);
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

  // প্রস্তাবিত রুব্রিক — কী-নোট/ক্লিনিক্যালের সাথে টেক্সট মিলিয়ে
  const loadRubricSuggestions = async (remedy, linkedRows = []) => {
    setSuggestBusy(true);
    try {
      const rubrics = allRubrics || (await api.getRubrics());
      if (!allRubrics) setAllRubrics(rubrics);
      const list = suggestRubricsForRemedy(remedy, rubrics, {
        excludeIds: (linkedRows || []).map((r) => r.id),
      });
      setSuggestions(list);
      setSuggestGrades(Object.fromEntries(list.map((s) => [s.rubric.id, 1])));
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    } finally {
      setSuggestBusy(false);
    }
  };

  const toggleSuggestions = () => {
    if (suggestions) {
      setSuggestions(null);
      return;
    }
    loadRubricSuggestions(selected, profile || []);
  };

  // মাঝপথে ম্যানুয়ালি লিংক করলে প্রস্তাব-তালিকা থেকেও সরে যায়
  const visibleSuggestions = useMemo(() => {
    if (!suggestions) return [];
    const linked = new Set((profile || []).map((p) => p.id));
    return suggestions.filter((s) => !linked.has(s.rubric.id));
  }, [suggestions, profile]);

  const addSuggestedLink = async (s) => {
    setNotice(null);
    try {
      await api.addRemedyRubric(selected.id, s.rubric.id, Number(suggestGrades[s.rubric.id] || 1));
      await refreshProfile(selected.id);
      setNotice({ text: `“${s.rubric.rubric_text}” রুব্রিক যুক্ত হয়েছে`, ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  const addAllSuggestedLinks = async () => {
    if (visibleSuggestions.length === 0) return;
    if (!confirm(`${visibleSuggestions.length}টি প্রস্তাবিত রুব্রিক যোগ করবেন? গ্রেডগুলো মিলিয়ে নিন।`)) return;
    setNotice(null);
    try {
      for (const s of visibleSuggestions) {
        await api.addRemedyRubric(selected.id, s.rubric.id, Number(suggestGrades[s.rubric.id] || 1));
      }
      await refreshProfile(selected.id);
      setNotice({ text: `${visibleSuggestions.length}টি রুব্রিক যুক্ত হয়েছে`, ok: true });
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // নতুন ওষুধ যোগ
  const submitAdd = async (form) => {
    setNotice(null);
    try {
      const created = await api.addRemedy(form);
      await loadRemedies();
      setShowAddForm(false);
      await openRemedy(created);
      setQuery('');
      setLetter('সব');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(`remedy-${created.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      setNotice({ text: `"${created.name}" যোগ করা হয়েছে — নিচে প্রস্তাবিত রুব্রিক দেখুন`, ok: true });
      loadRubricSuggestions(created, []);
    } catch (e) {
      setNotice({ text: e.message, ok: false });
    }
  };

  // ওষুধ সম্পাদনা
  const submitEdit = async (form) => {
    setNotice(null);
    try {
      await api.updateRemedy(selected.id, form);
      const updated = { ...selected, ...form };
      await loadRemedies();
      setSelected(updated);
      setEditing(false);
      setSuggestions(null); // টেক্সট বদলেছে — প্রস্তাব আবার খুঁজতে হবে
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
          <h2 className="page-title">ম্যাটেরিয়া মেডিকা</h2>
          <p className="page-sub">
            ওষুধ বেছে নিয়ে তার কী-নোট, ক্লিনিক্যাল ব্যবহার ও রেপার্টরি প্রোফাইল দেখুন
            {isAdmin ? ' — নতুন ওষুধ যোগ করলে টেক্সট-মিলে পাওয়া রুব্রিকের প্রস্তাব স্বয়ংক্রিয়ভাবে দেখাবে।' : '।'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowAddForm((v) => !v); setNotice(null); }}
            className="btn btn-primary"
          >
            {showAddForm ? '✕ বন্ধ করুন' : '＋ নতুন ওষুধ যোগ করুন'}
          </button>
        )}
      </div>

      {msg && <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{msg}</div>}
      {notice && (
        <div className={`text-sm px-3 py-2 rounded-lg border ${notice.ok ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
          {notice.text}
        </div>
      )}

      {isAdmin && showAddForm && (
        <RemedyForm
          initial={EMPTY_FORM}
          onSubmit={submitAdd}
          onCancel={() => setShowAddForm(false)}
          submitLabel="যোগ করুন"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-md"
          placeholder="🔍 ওষুধ খুঁজুন (নাম, উৎস, কী-নোট, ক্লিনিক্যাল, ভালো/মন্দ)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
      {query.trim() && (
        <p className="text-xs text-slate-500">
          {filtered.length === 0
            ? 'কোনো ওষুধ মেলেনি — বানান বদলে বা কম শব্দ লিখে দেখুন।'
            : `${filtered.length}টি ওষুধ দেখানো হচ্ছে${remedySearch.partial ? ' (কাছাকাছি)' : ''}`}
        </p>
      )}

      {/* বর্ণমালা ইনডেক্স */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-100 bg-slate-50 p-2">
        {['সব', ...letters].map((L) => (
          <button
            key={L}
            onClick={() => setLetter(L)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
              letter === L
                ? 'bg-teal-600 text-white border-teal-600 shadow-soft'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {L}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* ওষুধের তালিকা */}
        <div className="md:col-span-1 card p-2 max-h-[32rem] overflow-auto">
          {filtered.map((r) => (
            <button
              key={r.id}
              id={`remedy-${r.id}`}
              onClick={() => openRemedy(r)}
              className={`w-full text-left px-3 py-2 rounded-lg transition ${
                selected?.id === r.id ? 'bg-teal-50 ring-1 ring-inset ring-teal-200' : 'hover:bg-slate-50'
              }`}
            >
              <div className={`text-sm font-semibold ${selected?.id === r.id ? 'text-teal-700' : 'text-slate-800'}`}>
                {r.name}
                {!!r.is_custom && (
                  <span className="badge ml-2 border-amber-200 bg-amber-50 text-amber-700 align-middle">
                    নিজের যোগ করা
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 italic">{r.source}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              {query.trim()
                ? 'কোনো ওষুধ মেলেনি — বানান বদলে বা কম শব্দ লিখে দেখুন।'
                : customOnly
                  ? 'নিজের যোগ করা কোনো ওষুধ নেই — ফিল্টার বন্ধ করে দেখুন।'
                  : remedySearch.items.length > 0
                    ? 'এই অক্ষরে কোনো ওষুধ নেই — "সব" বেছে নিন।'
                    : 'কিছু পাওয়া যায়নি।'}
            </div>
          )}
        </div>

        {/* বিস্তারিত প্রোফাইল */}
        <div className="md:col-span-2">
          {!selected && (
            <div className="card p-6 text-slate-400 text-sm h-full flex items-center justify-center">
              ← বাম পাশ থেকে একটি ওষুধ নির্বাচন করুন
            </div>
          )}

          {selected && isAdmin && editing && (
            <div className="card p-5 space-y-3">
              <h3 className="text-lg font-bold text-slate-800">সম্পাদনা: {selected.name}</h3>
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
            <div className="card p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold text-teal-700">
                    {selected.name}
                    {!!selected.is_custom && (
                      <span className="badge ml-2 border-amber-200 bg-amber-50 text-amber-700 align-middle">
                        নিজের যোগ করা
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500 italic">উৎস: {selected.source}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditing(true); setNotice(null); }}
                      className="btn btn-ghost btn-sm"
                    >
                      ✎ সম্পাদনা
                    </button>
                    {!!selected.is_custom && (
                      <button
                        onClick={removeRemedy}
                        className="btn btn-danger btn-sm"
                      >
                        🗑 মুছুন
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
                <div className="section-title text-teal-700 mb-1">কী-নোট</div>
                <p className="text-sm text-slate-700">{selected.keynotes || '—'}</p>
              </div>

              {selected.clinical && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <div className="section-title text-blue-700 mb-1">ক্লিনিক্যাল ব্যবহার</div>
                  <p className="text-sm text-slate-700">{selected.clinical}</p>
                </div>
              )}

              {(selected.better || selected.worse) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-green-200 bg-green-50/60 p-3">
                    <div className="section-title text-green-700 mb-2">কীতে ভালো (মোডালিটি)</div>
                    <Chips text={selected.better} tone="good" />
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
                    <div className="section-title text-red-700 mb-2">কীতে বাড়ে (মোডালিটি)</div>
                    <Chips text={selected.worse} tone="bad" />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="section-title text-slate-700">রেপার্টরি প্রোফাইল</h4>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {profile && (
                      <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                        {profile.length} রুব্রিকে আছে · গ্রেড <GradeDots grade={3} /> = শক্তিশালী
                      </span>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={toggleSuggestions}
                          disabled={suggestBusy || loadingProfile}
                          className="btn btn-sm border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {suggestBusy ? '⟳ খোঁজা হচ্ছে…' : suggestions ? '✕ প্রস্তাব বন্ধ' : '✨ প্রস্তাবিত রুব্রিক'}
                        </button>
                        <button
                          onClick={() => setShowLinkPicker((v) => !v)}
                          className="btn btn-sm border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                        >
                          {showLinkPicker ? '✕ বন্ধ' : '＋ রুব্রিক যোগ'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isAdmin && showLinkPicker && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3 grid sm:grid-cols-4 gap-2 items-end">
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
                      <div className="w-20">
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
                        className="btn btn-primary btn-sm"
                      >
                        যোগ
                      </button>
                    </div>
                  </div>
                )}

                {loadingProfile && <div className="py-2 text-sm text-slate-400">লোড হচ্ছে…</div>}

                {isAdmin && suggestions && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 mb-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-amber-800">টেক্সট মিলিয়ে পাওয়া রুব্রিক</div>
                        <p className="text-xs text-amber-700/80">
                          স্বয়ংক্রিয় প্রস্তাব — গ্রেড মিলিয়ে যাচাই করে যোগ করুন।
                        </p>
                      </div>
                      {visibleSuggestions.length > 1 && (
                        <button
                          onClick={addAllSuggestedLinks}
                          className="btn btn-sm border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                        >
                          সব যোগ করুন ({visibleSuggestions.length})
                        </button>
                      )}
                    </div>

                    {visibleSuggestions.length === 0 ? (
                      <p className="text-sm text-amber-800/80 py-1">
                        {suggestions.length === 0
                          ? 'কোনো মিল পাওয়া যায়নি — উপরের "＋ রুব্রিক যোগ" দিয়ে নিজে বেছে নিতে পারেন।'
                          : 'সব প্রস্তাবিত রুব্রিক ইতিমধ্যে যুক্ত হয়েছে।'}
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {visibleSuggestions.map((s) => (
                          <li key={s.rubric.id} className="rounded-md border border-amber-100 bg-white px-2 py-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs rounded-full bg-slate-100 text-slate-500 px-2 py-0.5">
                                {s.rubric.section}
                              </span>
                              <span className="flex-1 min-w-[10rem] text-sm text-slate-700">
                                {s.rubric.rubric_text}
                              </span>
                              <select
                                className="text-xs border border-slate-200 rounded px-1 py-0.5 text-slate-600 bg-white"
                                value={suggestGrades[s.rubric.id] || 1}
                                title="গ্রেড"
                                onChange={(e) =>
                                  setSuggestGrades((g) => ({ ...g, [s.rubric.id]: Number(e.target.value) }))
                                }
                              >
                                <option value={1}>গ্রেড ১</option>
                                <option value={2}>গ্রেড ২</option>
                                <option value={3}>গ্রেড ৩</option>
                              </select>
                              <button onClick={() => addSuggestedLink(s)} className="btn btn-primary btn-sm">
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

                {!loadingProfile && grouped.length === 0 && profile && (
                  <div className="py-8 text-center text-sm text-slate-400">
                    {isAdmin
                      ? 'এই ওষুধটির জন্য কোনো রুব্রিক লিংক নেই — "✨ প্রস্তাবিত রুব্রিক" দেখুন বা "＋ রুব্রিক যোগ" দিয়ে নিজে বেছে নিন।'
                      : 'এই ওষুধটির জন্য এখনো কোনো রেপার্টরি রুব্রিক যুক্ত হয়নি।'}
                  </div>
                )}

                <div className="space-y-3">
                  {grouped.map(([section, rows]) => (
                    <div key={section}>
                      <div className="section-title inline-flex rounded-full bg-slate-100 px-2.5 py-1 mb-1.5">
                        {section}
                      </div>
                      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                        {rows.map((row, i) => (
                          <li key={i} className="flex items-center gap-1 group">
                            <button
                              onClick={() => focusRubric(row)}
                              title="রেপার্টরিতে এই রুব্রিক দেখুন"
                              className="flex-1 text-left flex items-center gap-2 text-sm text-slate-700 px-2 py-1.5 rounded hover:bg-teal-50 hover:text-teal-700"
                            >
                              <GradeDots grade={row.grade} />
                              <span className="flex-1">{row.rubric_text}</span>
                              <span className="text-slate-300 group-hover:text-teal-400">↗</span>
                            </button>
                            {isAdmin && (
                              <>
                                <select
                                  className="text-xs border border-slate-200 rounded px-1 py-0.5 text-slate-500 bg-white opacity-0 group-hover:opacity-100 focus:opacity-100"
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
                                  className="text-xs text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 px-1"
                                >
                                  ✕
                                </button>
                              </>
                            )}
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
