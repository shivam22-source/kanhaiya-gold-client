import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/config';

export default function LogoutButton() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <button
      className="flex h-11 items-center justify-center rounded border border-slate-300 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      onClick={handleLogout}
      type="button"
    >
      Logout
    </button>
  );
}
