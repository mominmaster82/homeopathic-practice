import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

const statTone = {
  teal: 'bg-teal-50 text-teal-700 border-teal-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
};

function StatCard({ icon, title, value, to, tone }) {
  return (
    <Link to={to} className="card p-5 flex items-center gap-4 hover:shadow-card transition-shadow">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-xl ${statTone[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-3xl font-bold leading-none text-slate-800">{value}</span>
        <span className="mt-1 block text-sm text-slate-500">{title}</span>
      </span>
    </Link>
  );
}

function Panel({ title, to, toLabel, children }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <Link to={to} className="text-xs font-medium text-teal-700 hover:underline">
          {toLabel}
        </Link>
      </div>
      {children}
    </div>
  );
}

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
    { icon: '👤', title: 'রোগী', value: patients.length, to: '/patients', tone: 'teal' },
    { icon: '🗂', title: 'কেস', value: caseInfo.total, to: '/case', tone: 'blue' },
    { icon: '💊', title: 'ওষুধ', value: remedies.length, to: '/materia', tone: 'amber' },
    { icon: '📚', title: 'রুব্রিক', value: rubrics.length, to: '/repertory', tone: 'purple' },
  ];

  const links = [
    { to: '/case', label: '＋ নতুন কেস নাও', primary: true },
    { to: '/repertory', label: 'রেপার্টরি দেখো' },
    { to: '/analysis', label: 'বিশ্লেষণ করো' },
    { to: '/materia', label: 'ম্যাটেরিয়া মেডিকা' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">ড্যাশবোর্ড</h2>
        <p className="page-sub">আপনার ক্লিনিকের সারসংক্ষেপ ও দ্রুত কাজ।</p>
      </div>

      {/* পরিসংখ্যান */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <StatCard key={c.title} {...c} />
        ))}
      </div>

      {/* দ্রুত লিংক */}
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={l.primary ? 'btn btn-primary' : 'btn btn-ghost'}>
            {l.label}
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* সাম্প্রতিক রোগী */}
        <Panel title="সাম্প্রতিক রোগী" to="/patients" toLabel="সব দেখুন">
          <ul className="divide-y divide-slate-100">
            {patients.slice(0, 5).map((p) => (
              <li key={p.id} className="py-2.5 flex justify-between items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700 text-sm font-semibold">
                    {(p.name || '?').trim().charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{p.name}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {p.phone || 'ফোন নেই'}
                      {p.age ? ` · ${p.age} বছর` : ''}
                    </div>
                  </div>
                </div>
                <Link to={`/patients/${p.id}`} className="text-xs font-medium text-teal-700 hover:underline shrink-0">
                  দেখুন
                </Link>
              </li>
            ))}
            {patients.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">এখনো কোনো রোগী নেই।</li>
            )}
          </ul>
        </Panel>

        {/* সাম্প্রতিক কেস */}
        <Panel title="সাম্প্রতিক কেস" to="/case" toLabel="সব দেখুন">
          <ul className="divide-y divide-slate-100">
            {caseInfo.recent.map((c) => (
              <li key={c.id} className="py-2.5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    #{c.id} · {c.patient_name}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {c.date}
                    {c.symptoms ? ` · ${c.symptoms}` : ''}
                  </div>
                </div>
                <Link to={`/print/${c.id}`} className="btn btn-ghost btn-sm shrink-0">
                  🖨 প্রিন্ট
                </Link>
              </li>
            ))}
            {caseInfo.recent.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">এখনো কোনো কেস নেই।</li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
