import { getUserFromSession } from '../auth.js';

export async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromSession(req);
    if (!user) return res.status(401).json({ message: 'Authentication required.' });
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
