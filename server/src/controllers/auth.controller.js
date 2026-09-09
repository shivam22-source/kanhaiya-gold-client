import { authenticateUser, clearSessionCookie, createSession, createUser, deleteSession, getUserFromSession, setSessionCookie } from '../auth.js';

export async function register(req, res) {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  if (username.length < 3) {
    return res.status(400).json({ message: 'Username should be at least 3 characters.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password should be at least 6 characters.' });
  }

  try {
    const user = await createUser(username, password);
    const token = await createSession(user.id);
    setSessionCookie(res, token);
    return res.status(201).json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Username already exists.' });
    }
    throw error;
  }
}

export async function login(req, res) {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = await authenticateUser(username, password);
  if (!user) return res.status(401).json({ message: 'Invalid username or password.' });

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  return res.json({ user });
}

export async function me(req, res) {
  const user = await getUserFromSession(req);
  if (!user) return res.status(401).json({ message: 'Not authenticated.' });
  return res.json({ user });
}

export async function logout(req, res) {
  await deleteSession(req);
  clearSessionCookie(res);
  return res.json({ ok: true });
}
