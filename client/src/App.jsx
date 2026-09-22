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
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-teal-50'
  }`;

// সুরক্ষিত রুট — লগইন না করা থাকলে /login এ পাঠাবে
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// মূল অ্যাপ কন্টেন্ট (হেডার + রুট)
function AppContent() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated && (
        <header className="bg-white shadow print:hidden">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-teal-700 mr-4">🌿 হোমিওপ্যাথি</h1>
            <nav className="flex flex-wrap gap-1 flex-1">
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
              className="px-3 py-2 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
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
