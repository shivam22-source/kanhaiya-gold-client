import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { google } from 'googleapis';
import { v2 as cloudinary } from 'cloudinary';
import pg from 'pg';

const { Pool } = pg;

const required = ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_DRIVE_FOLDER_ID'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const shouldBackupImages = process.env.BACKUP_IMAGES === 'true';
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanhaiya-backup-'));
const date = new Date().toISOString().slice(0, 10);

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob',
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth });

async function uploadFile(filePath, name, parentId, mimeType) {
  const response = await drive.files.create({
    requestBody: { name, parents: [parentId], mimeType },
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: 'id,name,size,createdTime',
  });
  return response.data;
}

async function ensureFolder(name, parentId) {
  const q = [
    `'${parentId}' in parents`,
    `name = '${name.replaceAll("'", "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');
  const found = await drive.files.list({ q, fields: 'files(id,name)' });
  if (found.data.files?.[0]) return found.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return created.data.id;
}

async function backupDatabase() {
  const out = path.join(workDir, `database-${date}.sql.gz`);
  const result = spawnSync('pg_dump', [process.env.DATABASE_URL, '--no-owner', '--no-acl'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (result.status !== 0) throw new Error('pg_dump failed');
  const gzip = spawnSync('gzip', [], { input: result.stdout });
  if (gzip.status !== 0) throw new Error('gzip failed');
  fs.writeFileSync(out, gzip.stdout);

  const folder = await ensureFolder('Database Backups', process.env.GOOGLE_DRIVE_FOLDER_ID);
  const uploaded = await uploadFile(out, path.basename(out), folder, 'application/gzip');
  console.log(`Database backup uploaded: ${uploaded.name} (${uploaded.size || 'unknown'} bytes)`);
}

async function backupImages() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const parent = await ensureFolder('Cloudinary Image Backups', process.env.GOOGLE_DRIVE_FOLDER_ID);
  const snapshotFolder = await ensureFolder(date, parent);
  let nextCursor;
  let count = 0;

  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      prefix: 'gold-items',
      max_results: 500,
      next_cursor: nextCursor,
    });

    for (const resource of result.resources || []) {
      const response = await fetch(resource.secure_url);
      if (!response.ok) throw new Error(`Could not download Cloudinary asset ${resource.public_id}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = resource.format ? `.${resource.format}` : '';
      const safeName = `${resource.public_id.replaceAll('/', '__')}${ext}`;
      const local = path.join(workDir, safeName);
      fs.writeFileSync(local, buffer);
      await uploadFile(local, safeName, snapshotFolder, `image/${resource.format || 'jpeg'}`);
      fs.unlinkSync(local);
      count += 1;
    }
    nextCursor = result.next_cursor;
  } while (nextCursor);

  console.log(`Cloudinary image backup uploaded: ${count} asset(s)`);
}

try {
  await backupDatabase();
  if (shouldBackupImages) await backupImages();
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
