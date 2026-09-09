import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AUTH_STORAGE_KEY = 'kanhaiya-gold-auth';
const USERNAME_KEY = 'kanhaiya-gold-username';

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(() => Boolean(localStorage.getItem(AUTH_STORAGE_KEY)));

  const title = useMemo(() => (mode === 'login' ? 'Welcome back' : 'Create account'), [mode]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Please enter username and password.');
      return;
    }

    if (mode === 'create') {
      if (password.length < 4) {
        setError('Password should be at least 4 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      localStorage.setItem(AUTH_STORAGE_KEY, password);
      localStorage.setItem(USERNAME_KEY, cleanUsername);
      setSaved(true);
      navigate('/', { replace: true });
      return;
    }

    const savedPassword = localStorage.getItem(AUTH_STORAGE_KEY);
    const savedUsername = localStorage.getItem(USERNAME_KEY);

    if (!savedPassword || !savedUsername) {
      setError('No account found. Create an account first.');
      setMode('create');
      return;
    }

    if (cleanUsername !== savedUsername || password !== savedPassword) {
      setError('Invalid username or password.');
      return;
    }

    navigate('/', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 text-slate-900">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">Kanhaiya Gold</p>
          <h1 className="mt-2 text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' ? 'Sign in to continue to the app.' : 'Create a simple app account on this device.'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">User ID</span>
            <input
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter user ID"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Password</span>
            <input
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
            />
          </label>

          {mode === 'create' && (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Confirm Password</span>
              <input
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
              />
            </label>
          )}

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}

          <button
            className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
            type="submit"
          >
            {mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <button className="font-semibold text-indigo-600 hover:underline" onClick={() => setMode('create')} type="button">
              Create a new account
            </button>
          ) : (
            <button className="font-semibold text-indigo-600 hover:underline" onClick={() => setMode('login')} type="button">
              Back to login
            </button>
          )}
        </div>

        {saved && mode === 'login' && (
          <p className="mt-4 text-center text-xs text-slate-400">Account is stored on this device.</p>
        )}
      </section>
    </main>
  );
}
