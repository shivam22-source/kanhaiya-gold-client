import { google } from 'googleapis';
import crypto from 'node:crypto';
import express from 'express';

const router = express.Router();

const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  'https://kanhaiya-gold-client.onrender.com/api/backup/google/callback';

const pendingStates = new Map();

function getOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials are not configured');
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
  );
}

router.get('/google/start', (_req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, Date.now());

  const oauth2Client = getOAuthClient();
  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
    state,
  });

  res.redirect(authorizationUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send(`Google authorization failed: ${String(error)}`);
    }

    if (!code || !state || !pendingStates.has(state)) {
      return res.status(400).send('Invalid or expired Google OAuth state. Start authorization again.');
    }

    const createdAt = pendingStates.get(state);
    pendingStates.delete(state);
    if (Date.now() - createdAt > 10 * 60 * 1000) {
      return res.status(400).send('Google OAuth authorization expired. Start again.');
    }

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(String(code));

    if (!tokens.refresh_token) {
      return res.status(400).send('No refresh token returned. Start again and keep consent enabled.');
    }

    const escapedToken = String(tokens.refresh_token)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Google Backup Authorization</title></head>
<body style="font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:20px;line-height:1.6">
<h2>Google Drive authorization successful</h2>
<p>Copy the refresh token below into the <code>GOOGLE_REFRESH_TOKEN</code> secret in GitHub Actions.</p>
<p><strong>Do not share this token publicly.</strong></p>
<textarea readonly style="width:100%;min-height:120px;padding:12px">${escapedToken}</textarea>
</body></html>`);
  } catch (error) {
    console.error('Google backup OAuth callback failed:', error);
    res.status(500).send('Google backup authorization failed. Check the server logs.');
  }
});

export default router;
