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
  const focusApplied = useRef(null);

  useEffect(() => {
    api.getRemedies().then(setRemedies).catch((e) => setMsg(e.message));
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

  // রেপার্টরিতে গিয়ে এই রুব্রিকে ফোকাস করি
  const focusRubric = (row) =>
    navigate('/repertory', { state: { focusRubricId: row.id, section: row.section } });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">ম্যাটেরিয়া মেডিকা</h2>
        <p className="text-sm text-gray-500">
          ওষুধ বেছে নিয়ে তার কী-নোট ও রেপার্টরি প্রোফাইল (কোন রুব্রিকে কোন গ্রেডে আছে) দেখুন।
        </p>
      </div>

      {msg && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{msg}</div>}

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

          {selected && (
            <div className="bg-white rounded-xl shadow p-5 space-y-4">
              <div>
                <h3 className="text-xl font-bold text-teal-700">{selected.name}</h3>
                <p className="text-sm text-gray-500 italic">উৎস: {selected.source}</p>
              </div>

              <div className="bg-teal-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-teal-700 mb-1">কী-নোট</div>
                <p className="text-sm text-gray-700">{selected.keynotes}</p>
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
                  {profile && (
                    <span className="text-xs text-gray-400">
                      {profile.length} রুব্রিকে আছে · গ্রেড <GradeDots grade={3} /> = শক্তিশালী
                    </span>
                  )}
                </div>

                {loadingProfile && <div className="text-sm text-gray-400">লোড হচ্ছে…</div>}

                {!loadingProfile && grouped.length === 0 && profile && (
                  <div className="text-sm text-gray-400">
                    এই ওষুধটির জন্য কোনো রুব্রিক লিংক নেই।
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
                          <li key={i}>
                            <button
                              onClick={() => focusRubric(row)}
                              title="রেপার্টরিতে এই রুব্রিক দেখুন"
                              className="w-full text-left flex items-center gap-2 text-sm text-gray-700 px-2 py-1 rounded hover:bg-teal-50 hover:text-teal-700"
                            >
                              <GradeDots grade={row.grade} />
                              <span className="flex-1">{row.rubric_text}</span>
                              <span className="text-gray-300">↗</span>
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
