import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Patients from './pages/Patients.jsx';
import PatientProfile from './pages/PatientProfile.jsx';
import CaseTaking from './pages/CaseTaking.jsx';
import Repertory from './pages/Repertory.jsx';
import MateriaMedica from './pages/MateriaMedica.jsx';
import Analysis from './pages/Analysis.jsx';
import PrescriptionPrint from './pages/PrescriptionPrint.jsx';
import Settings from './pages/Settings.jsx';

const navItem = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-teal-50'
  }`;

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-teal-700 mr-4">🌿 হোমিওপ্যাথি</h1>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={navItem}>হোম</NavLink>
            <NavLink to="/patients" className={navItem}>রোগী</NavLink>
            <NavLink to="/case" className={navItem}>কেস</NavLink>
            <NavLink to="/repertory" className={navItem}>রেপার্টরি</NavLink>
            <NavLink to="/materia" className={navItem}>ম্যাটেরিয়া মেডিকা</NavLink>
            <NavLink to="/analysis" className={navItem}>বিশ্লেষণ</NavLink>
            <NavLink to="/settings" className={navItem}>⚙ সেটিংস</NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientProfile />} />
          <Route path="/case" element={<CaseTaking />} />
          <Route path="/repertory" element={<Repertory />} />
          <Route path="/materia" element={<MateriaMedica />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/print/:caseId" element={<PrescriptionPrint />} />
        </Routes>
      </main>
    </div>
  );
}
