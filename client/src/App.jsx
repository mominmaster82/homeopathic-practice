import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patients from './pages/Patients.jsx';
import PatientProfile from './pages/PatientProfile.jsx';
import CaseTaking from './pages/CaseTaking.jsx';
import Repertory from './pages/Repertory.jsx';
import MateriaMedica from './pages/MateriaMedica.jsx';
import Analysis from './pages/Analysis.jsx';
import PrescriptionPrint from './pages/PrescriptionPrint.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';

const navItem = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
    isActive
      ? 'bg-teal-600 text-white shadow-soft'
      : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700'
  }`;

// সুরক্ষিত রুট — লগইন না করা থাকলে /login এ পাঠাবে
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
          <span className="text-sm">লোড হচ্ছে…</span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// মূল অ্যাপ কন্টেন্ট (হেডার + রুট)
function AppContent() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen">
      {isAuthenticated && (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur print:hidden">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
            <NavLink to="/" className="flex items-center gap-2.5 mr-2 shrink-0">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-lg shadow-soft">
                🌿
              </span>
              <span className="text-base font-bold text-slate-800 leading-tight">
                হোমিওপ্যাথি
                <span className="block text-[11px] font-medium text-slate-400 -mt-0.5">
                  প্র্যাকটিস ম্যানেজমেন্ট
                </span>
              </span>
            </NavLink>

            <nav className="flex flex-wrap gap-1 flex-1 -mx-1 px-1">
              <NavLink to="/" end className={navItem}>হোম</NavLink>
              <NavLink to="/patients" className={navItem}>রোগী</NavLink>
              <NavLink to="/case" className={navItem}>কেস</NavLink>
              <NavLink to="/repertory" className={navItem}>রেপার্টরি</NavLink>
              <NavLink to="/materia" className={navItem}>ম্যাটেরিয়া মেডিকা</NavLink>
              <NavLink to="/analysis" className={navItem}>বিশ্লেষণ</NavLink>
              <NavLink to="/settings" className={navItem}>⚙ সেটিংস</NavLink>
            </nav>

            <button
              onClick={logout}
              className="btn btn-danger btn-sm shrink-0"
            >
              লগআউট
            </button>
          </div>
        </header>
      )}

      <main className={isAuthenticated ? 'max-w-6xl mx-auto px-4 py-6' : ''}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
          <Route path="/case" element={<ProtectedRoute><CaseTaking /></ProtectedRoute>} />
          <Route path="/repertory" element={<ProtectedRoute><Repertory /></ProtectedRoute>} />
          <Route path="/materia" element={<ProtectedRoute><MateriaMedica /></ProtectedRoute>} />
          <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/print/:caseId" element={<ProtectedRoute><PrescriptionPrint /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
