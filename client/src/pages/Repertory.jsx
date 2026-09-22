import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api.js';

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

  useEffect(() => { api.getSections().then(setSections).catch(() => {}); }, []);
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
    setOpen(focusId);
    api.getRubricRemedies(focusId).then(setRemedies).catch(() => {});
    document.getElementById(`rubric-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const toggleOpen = async (id) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    setRemedies(await api.getRubricRemedies(id));
  };

  const goToAnalysis = () => navigate('/analysis', { state: { rubricIds: selected } });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-gray-800">রেপার্টরি</h2>
        <button
          onClick={goToAnalysis}
          disabled={selected.length === 0}
          className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          বিশ্লেষণে পাঠান ({selected.length})
        </button>
      </div>

      <input
        className="border rounded-md px-3 py-2 w-full max-w-sm"
        placeholder="🔍 রুব্রিক খুঁজুন..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSection('')}
          className={`px-3 py-1 rounded-full text-sm ${!section ? 'bg-teal-600 text-white' : 'bg-gray-200'}`}
        >
          সব
        </button>
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-3 py-1 rounded-full text-sm ${section === s ? 'bg-teal-600 text-white' : 'bg-gray-200'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="text-sm text-teal-700">
          নির্বাচিত: {selected.length}টি রুব্রিক
          <button onClick={() => setSelected([])} className="ml-2 underline">মুছুন</button>
        </div>
      )}

      {grouped.map(([sec, items]) => (
        <div key={sec} className="bg-white rounded-xl shadow">
          <div className="px-4 py-2 bg-gray-100 rounded-t-xl font-semibold text-gray-700">{sec}</div>
          <div className="divide-y">
            {items.map((r) => (
              <div
                key={r.id}
                id={`rubric-${r.id}`}
                className={`flex items-start gap-2 px-4 py-2 ${
                  r.id === focusId ? 'bg-teal-50 ring-1 ring-inset ring-teal-300' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  title="বিশ্লেষণের জন্য নির্বাচন"
                />
                <button
                  onClick={() => toggleOpen(r.id)}
                  className="flex-1 text-left hover:text-teal-700 flex justify-between items-center"
                >
                  <span>{r.rubric_text}</span>
                  <span className="text-gray-400 ml-2">{open === r.id ? '−' : '+'}</span>
                </button>
                {open === r.id && (
                  <div className="basis-full flex flex-wrap gap-2 pt-1">
                    {remedies.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => navigate('/materia', { state: { focusRemedyId: m.id } })}
                        title="ম্যাটেরিয়া মেডিকায় এই ওষুধ দেখুন"
                        className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm hover:bg-amber-200"
                      >
                        {m.name} <b>({m.grade})</b> ↗
                      </button>
                    ))}
                    {remedies.length === 0 && <span className="text-sm text-gray-400">কোনো ওষুধ নেই</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && <div className="text-gray-500">কোনো রুব্রিক পাওয়া যায়নি।</div>}
    </div>
  );
}
