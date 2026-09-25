import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'লগইন ব্যর্থ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="max-w-md w-full">
        <div className="card p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-3xl shadow-soft">
              🌿
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800 mb-2">হোমিওপ্যাথি</h1>
            <p className="text-sm text-slate-500">অ্যাপে প্রবেশ করতে ইমেইল ও পাসওয়ার্ড দিন</p>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">
                ইমেইল
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="আপনার ইমেইল"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">
                পাসওয়ার্ড
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="আপনার পাসওয়ার্ড"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'লগইন হচ্ছে…' : 'লগইন'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
