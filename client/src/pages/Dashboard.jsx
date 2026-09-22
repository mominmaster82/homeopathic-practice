import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

export default function Dashboard() {
  const [patients, setPatients] = useState([]);
  const [remedies, setRemedies] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [caseInfo, setCaseInfo] = useState({ total: 0, recent: [] });

  useEffect(() => {
    Promise.all([
      api.getPatients(),
      api.getRemedies(),
      api.getRubrics(),
      api.getRecentCases(5),
    ])
      .then(([p, r, ru, c]) => {
        setPatients(p);
        setRemedies(r);
        setRubrics(ru);
        setCaseInfo(c);
      })
      .catch(() => {});
  }, []);

  const cards = [
    { title: 'রোগী', value: patients.length, to: '/patients', color: 'bg-teal-100 text-teal-800' },
    { title: 'কেস', value: caseInfo.total, to: '/case', color: 'bg-blue-100 text-blue-800' },
    { title: 'ওষুধ', value: remedies.length, to: '/materia', color: 'bg-amber-100 text-amber-800' },
    { title: 'রুব্রিক', value: rubrics.length, to: '/repertory', color: 'bg-purple-100 text-purple-800' },
  ];

  const links = [
    { to: '/case', label: '＋ নতুন কেস নাও' },
    { to: '/repertory', label: 'রেপার্টরি দেখো' },
    { to: '/analysis', label: 'বিশ্লেষণ করো' },
    { to: '/materia', label: 'ম্যাটেরিয়া মেডিকা' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">ড্যাশবোর্ড</h2>
        <p className="text-sm text-gray-500">আপনার ক্লিনিকের সারসংক্ষেপ ও দ্রুত কাজ।</p>
      </div>

      {/* পরিসংখ্যান */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.title} to={c.to} className={`rounded-xl p-5 ${c.color} shadow-sm hover:opacity-90`}>
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm mt-1">{c.title}</div>
          </Link>
        ))}
      </div>

      {/* দ্রুত লিংক */}
      <div className="flex flex-wrap gap-3">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700">
            {l.label}
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* সাম্প্রতিক রোগী */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">সাম্প্রতিক রোগী</h3>
            <Link to="/patients" className="text-xs text-teal-700 hover:underline">সব দেখুন</Link>
          </div>
          <ul className="divide-y">
            {patients.slice(0, 5).map((p) => (
              <li key={p.id} className="py-2 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-400">
                    {p.phone || 'ফোন নেই'}
                    {p.age ? ` · ${p.age} বছর` : ''}
                  </div>
                </div>
                <Link to="/patients" className="text-xs text-teal-700 hover:underline">দেখুন</Link>
              </li>
            ))}
            {patients.length === 0 && <li className="py-2 text-sm text-gray-400">এখনো কোনো রোগী নেই।</li>}
          </ul>
        </div>

        {/* সাম্প্রতিক কেস */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">সাম্প্রতিক কেস</h3>
            <Link to="/case" className="text-xs text-teal-700 hover:underline">সব দেখুন</Link>
          </div>
          <ul className="divide-y">
            {caseInfo.recent.map((c) => (
              <li key={c.id} className="py-2 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    #{c.id} · {c.patient_name}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {c.date}
                    {c.symptoms ? ` · ${c.symptoms}` : ''}
                  </div>
                </div>
                <Link to={`/print/${c.id}`} className="text-xs text-teal-700 hover:underline shrink-0">
                  🖨 প্রিন্ট
                </Link>
              </li>
            ))}
            {caseInfo.recent.length === 0 && <li className="py-2 text-sm text-gray-400">এখনো কোনো কেস নেই।</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
