import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';

export default function PrescriptionPrint() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [patient, setPatient] = useState(null);
  const [settings, setSettings] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const c = await api.getCase(caseId);
        setCaseData(c);
        setPatient(await api.getPatient(c.patient_id));
      } catch (e) {
        setMsg(e.message);
      }
    })();
    api.getSettings().then(setSettings).catch(() => {});
  }, [caseId]);

  if (msg) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{msg}</div>
        <button onClick={() => navigate('/case')} className="text-teal-700 hover:underline text-sm">
          ← কেস পেজে ফিরে যান
        </button>
      </div>
    );
  }

  if (!caseData || !patient) {
    return <div className="text-sm text-gray-400">লোড হচ্ছে…</div>;
  }

  return (
    <div className="space-y-4">
      {/* এই বাটনগুলো প্রিন্টে দেখাবে না */}
      <div className="flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700"
        >
          🖨 প্রিন্ট / PDF সেভ
        </button>
        <button
          onClick={() => navigate('/case')}
          className="bg-gray-200 px-4 py-2 rounded-md hover:bg-gray-300"
        >
          ← ফিরে যান
        </button>
      </div>

      {/* প্রিন্ট-বান্ধব রিসিট */}
      <div className="bg-white max-w-2xl mx-auto p-8 rounded-xl shadow print:shadow-none print:rounded-none">
        <div className="flex items-center justify-center gap-4 border-b-2 border-teal-600 pb-3 mb-4">
          {settings.logo && (
            <img src={settings.logo} alt="লোগো" className="w-16 h-16 object-contain" />
          )}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-teal-700">
              {settings.clinic_name || '🌿 হোমিওপ্যাথি ক্লিনিক'}
            </h2>
            {settings.doctor_name && (
              <p className="text-sm font-medium text-gray-700">{settings.doctor_name}</p>
            )}
            {(settings.address || settings.phone || settings.email) && (
              <p className="text-xs text-gray-500">
                {[settings.address, settings.phone, settings.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between text-sm mb-4">
          <div className="space-y-0.5">
            <div><b>রোগী:</b> {patient.name}</div>
            {(patient.age || patient.gender) && (
              <div>
                {patient.age ? `বয়স: ${patient.age}` : ''}
                {patient.age && patient.gender ? ' · ' : ''}
                {patient.gender ? `লিংগ: ${patient.gender}` : ''}
              </div>
            )}
            {patient.phone && <div><b>ফোন:</b> {patient.phone}</div>}
          </div>
          <div className="text-right space-y-0.5">
            <div><b>কেস:</b> #{caseData.id}</div>
            <div><b>তারিখ:</b> {caseData.date}</div>
          </div>
        </div>

        {caseData.symptoms && (
          <div className="text-sm mb-4 bg-gray-50 rounded p-2">
            <b>লক্ষণ:</b> {caseData.symptoms}
          </div>
        )}

        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-gray-300 text-left">
              <th className="py-1 pr-2 w-8">ক্রম</th>
              <th className="py-1 pr-2">ওষুধ</th>
              <th className="py-1 pr-2">শক্তি</th>
              <th className="py-1">মাত্রা</th>
            </tr>
          </thead>
          <tbody>
            {caseData.prescriptions.map((p, i) => (
              <tr key={p.id} className="border-b border-gray-200">
                <td className="py-1.5 pr-2">{i + 1}.</td>
                <td className="py-1.5 pr-2 font-semibold">{p.remedy_name}</td>
                <td className="py-1.5 pr-2">{p.potency || '—'}</td>
                <td className="py-1.5">{p.dose || '—'}</td>
              </tr>
            ))}
            {caseData.prescriptions.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-gray-400">কোনো ওষুধ যোগ করা হয়নি।</td>
              </tr>
            )}
          </tbody>
        </table>

        {caseData.notes && (
          <div className="text-sm mb-6">
            <b>নোট:</b> {caseData.notes}
          </div>
        )}

        {settings.footer_note && (
          <div className="text-xs text-gray-500 italic border-t border-dashed border-gray-300 pt-2 mb-4">
            {settings.footer_note}
          </div>
        )}

        <div className="mt-10 flex justify-end">
          <div className="text-center text-sm">
            <div className="border-t border-gray-400 pt-1 w-40">
              {settings.doctor_name ? `স্বাক্ষর · ${settings.doctor_name}` : 'স্বাক্ষর (চিকিৎসক)'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
