import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

export default function Login() {
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
      const result = await api.login(password);
      login(result.token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'লগইন ব্যর্থ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-teal-700 mb-2">🌿 হোমিওপ্যাথি</h1>
            <p className="text-gray-600">অ্যাপে প্রবেশ করতে পাসওয়ার্ড দিন</p>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                পাসওয়ার্ড
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border rounded-md px-3 py-2 w-full"
                placeholder="আপনার পাসওয়ার্ড"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white rounded-md px-4 py-2 hover:bg-teal-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'লগইন হচ্ছে…' : 'লগইন'}
            </button>
          </form>

          <div className="mt-4 text-xs text-gray-500 text-center">
            প্রথমবার ব্যবহারের জন্য ডিফল্ট পাসওয়ার্ড: <code className="bg-gray-100 px-2 py-1 rounded">admin</code>
            <br />
            (লগইনের পর সেটিংস থেকে পরিবর্তন করুন)
          </div>
        </div>
      </div>
    </div>
  );
}
