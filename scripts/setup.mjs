import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const target = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(target) && process.argv.includes('--reset-admin')) {
  const password = randomBytes(18).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  const contents = readFileSync(target, 'utf8');
  if (!/^DEV_ADMIN_PASSWORD_HASH=.*$/m.test(contents))
    throw new Error('Missing DEV_ADMIN_PASSWORD_HASH in .env; repair it using .env.example.');
  writeFileSync(
    target,
    contents.replace(/^DEV_ADMIN_PASSWORD_HASH=.*$/m, `DEV_ADMIN_PASSWORD_HASH=${salt}:${hash}`),
    { mode: 0o600 },
  );
  console.log(`Local admin password reset. Restart the API to apply it.\nPassword: ${password}`);
} else if (existsSync(target)) {
  console.log('.env already exists; preserved. See README for credential reset.');
} else {
  const password = randomBytes(18).toString('base64url');
  const databasePassword = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  writeFileSync(
    target,
    `NODE_ENV=development\nAPI_PORT=3000\nWEB_ORIGIN=http://localhost:5173\nPOSTGRES_USER=support_dev\nPOSTGRES_PASSWORD=${databasePassword}\nPOSTGRES_DB=support_dev\nPOSTGRES_PORT=5432\nDATABASE_URL=postgresql://support_dev:${databasePassword}@localhost:5432/support_dev\nDEV_ADMIN_EMAIL=admin@example.test\nDEV_ADMIN_PASSWORD_HASH=${salt}:${hash}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    `Local environment created. Save these development-only credentials:\nEmail: admin@example.test\nPassword: ${password}\nThe password is shown once; only its salted hash is stored.`,
  );
}
