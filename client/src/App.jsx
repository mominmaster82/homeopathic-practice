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
import Users from './pages/Users.jsx';
import Login from './pages/Login.jsx';

const navItem = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
    isActive
      ? 'bg-teal-600 text-white shadow-soft'
      : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700'
  }`;

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
        <span className="text-sm">লোড হচ্ছে…</span>
      </div>
    </div>
  );
}

// সুরক্ষিত রুট — লগইন নেই → /login; প্রোফাইল নেই/স্থগিত → অ্যাক্সেস বার্তা
function ProtectedRoute({ children }) {
  const { user, profile, profileError, isAuthenticated, isActive, loading, logout } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!isActive) {
    const suspended = profile?.status === 'suspended';
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full text-center space-y-3">
          <div className="text-4xl">{suspended ? '⏸' : '🔒'}</div>
          <h1 className="text-xl font-bold text-slate-800">
            {suspended ? 'অ্যাকাউন্ট স্থগিত' : 'অ্যাক্সেস এখনো চালু হয়নি'}
          </h1>
          <p className="text-sm text-slate-500">
            {suspended
              ? 'আপনার অ্যাকাউন্টটি সাময়িকভাবে বন্ধ আছে। অ্যাডমিনের সাথে যোগাযোগ করুন।'
              : 'আপনার অ্যাকাউন্ট তৈরি হয়েছে, তবে রোল বা সাবস্ক্রিপশন এখনো সেট করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।'}
          </p>
          {!profile && (
            <p className="text-xs text-slate-400">
              {profileError || 'প্রোফাইল পাওয়া যায়নি'} · {user?.email}
            </p>
          )}
          <div className="flex justify-center gap-2 pt-1">
            {!profile && (
              <button onClick={() => window.location.reload()} className="btn btn-primary">
                আবার চেষ্টা করুন
              </button>
            )}
            <button onClick={logout} className="btn btn-ghost">
              লগআউট
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

// প্রশাসনিক/ডাক্তারি রুট — subscriber এখানে ঢুকতে পারবে না
function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/repertory" replace />;
  return children;
}

function LoginRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/' : '/repertory'} replace />;
  }
  return <Login />;
}

// মূল অ্যাপ কন্টেন্ট (হেডার + রুট)
function AppContent() {
  const { user, isAuthenticated, isActive, isAdmin, logout } = useAuth();

  return (
    <div className="min-h-screen">
      {isAuthenticated && (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur print:hidden">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
            <NavLink
              to={isAdmin ? '/' : '/repertory'}
              className="flex items-center gap-2.5 mr-2 shrink-0"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-lg shadow-soft">
                🌿
              </span>
              <span className="text-base font-bold text-slate-800 leading-tight">
                হোমিওপ্যাথি
                <span className="block text-[11px] font-medium text-slate-400 -mt-0.5">
                  {isAdmin ? 'প্র্যাকটিস ম্যানেজমেন্ট' : 'রেফারেন্স লাইব্রেরি'}
                </span>
              </span>
            </NavLink>

            {isActive && (
              <nav className="flex flex-wrap gap-1 flex-1 -mx-1 px-1">
                {isAdmin && (
                  <>
                    <NavLink to="/" end className={navItem}>হোম</NavLink>
                    <NavLink to="/patients" className={navItem}>রোগী</NavLink>
                    <NavLink to="/case" className={navItem}>কেস</NavLink>
                  </>
                )}
                <NavLink to="/repertory" className={navItem}>রেপার্টরি</NavLink>
                <NavLink to="/materia" className={navItem}>ম্যাটেরিয়া মেডিকা</NavLink>
                <NavLink to="/analysis" className={navItem}>বিশ্লেষণ</NavLink>
                {isAdmin && (
                  <>
                    <NavLink to="/users" className={navItem}>ইউজার</NavLink>
                    <NavLink to="/settings" className={navItem}>⚙ সেটিংস</NavLink>
                  </>
                )}
              </nav>
            )}

            {isActive && (
              <span
                className={`badge shrink-0 ${
                  isAdmin
                    ? 'border-teal-200 bg-teal-50 text-teal-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
                title={user?.email || ''}
              >
                {isAdmin ? 'সুপার অ্যাডমিন' : 'রিড-ওনলি'}
              </span>
            )}

            <button onClick={logout} className="btn btn-danger btn-sm shrink-0">
              লগআউট
            </button>
          </div>
        </header>
      )}

      <main className={isAuthenticated ? 'max-w-6xl mx-auto px-4 py-6' : ''}>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/" element={<ProtectedRoute><AdminRoute><Dashboard /></AdminRoute></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><AdminRoute><Patients /></AdminRoute></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute><AdminRoute><PatientProfile /></AdminRoute></ProtectedRoute>} />
          <Route path="/case" element={<ProtectedRoute><AdminRoute><CaseTaking /></AdminRoute></ProtectedRoute>} />
          <Route path="/repertory" element={<ProtectedRoute><Repertory /></ProtectedRoute>} />
          <Route path="/materia" element={<ProtectedRoute><MateriaMedica /></ProtectedRoute>} />
          <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><AdminRoute><Users /></AdminRoute></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AdminRoute><Settings /></AdminRoute></ProtectedRoute>} />
          <Route path="/print/:caseId" element={<ProtectedRoute><AdminRoute><PrescriptionPrint /></AdminRoute></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
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
