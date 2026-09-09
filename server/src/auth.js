import crypto from 'node:crypto';
import { pool } from './db.js';

const SESSION_COOKIE = 'kanhaiya_session';
const SESSION_DAYS = 7;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, stored) {
  const [, salt, expectedHash] = String(stored || '').split(':');
  if (!salt || !expectedHash) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const expected = Buffer.from(expectedHash, 'hex');
  const received = Buffer.from(actual, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=None`,
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None`,
  );
}

export function getSessionToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return match ? match.slice(SESSION_COOKIE.length + 1) : '';
}

export async function createUser(username, password) {
  const cleanUsername = username.trim();
  const { salt, hash } = hashPassword(password);
  const passwordHash = `scrypt:${salt}:${hash}`;

  const result = await pool.query(
    `INSERT INTO app_users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, created_at`,
    [cleanUsername, passwordHash],
  );

  return result.rows[0];
}

export async function authenticateUser(username, password) {
  const result = await pool.query(
    `SELECT id, username, password_hash
     FROM app_users
     WHERE username = $1`,
    [username.trim()],
  );

  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, username: user.username };
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO app_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  return token;
}

export async function getUserFromSession(req) {
  const token = getSessionToken(req);
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const result = await pool.query(
    `SELECT u.id, u.username
     FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash],
  );

  return result.rows[0] || null;
}

export async function deleteSession(req) {
  const token = getSessionToken(req);
  if (!token) return;
  await pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [hashSessionToken(token)]);
}
