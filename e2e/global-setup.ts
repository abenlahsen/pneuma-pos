import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env') });

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8888';
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@pneuma.pos';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? '';
const AUTH_FILE = path.join(__dirname, '.auth', 'state.json');

async function globalSetup(): Promise<void> {
  if (!ADMIN_PASSWORD) {
    throw new Error('E2E_ADMIN_PASSWORD est requis dans e2e/.env');
  }

  // Vérifier que l'application répond
  try {
    const probe = await fetch(`${BASE_URL}/api/login`, { method: 'HEAD' }).catch(() => null);
    if (!probe) {
      throw new Error(`L'application ne répond pas sur ${BASE_URL}. Lancez Docker avec "docker compose up".`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('ne répond pas')) throw err;
    // HEAD peut être refusé — on continue
  }

  // Login via API
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login E2E échoué (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { token: string; must_change_password?: boolean };
  const token = data.token;

  // Si le mot de passe doit être changé, le changer via API (même mot de passe)
  if (data.must_change_password) {
    const changeRes = await fetch(`${BASE_URL}/api/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: ADMIN_PASSWORD,
        password: ADMIN_PASSWORD,
        password_confirmation: ADMIN_PASSWORD,
      }),
    });

    if (!changeRes.ok) {
      console.warn('Impossible de changer le mot de passe initial. Les tests peuvent être redirigés vers /change-password.');
    }
  }

  // Sauvegarder le storage state au format Playwright
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(
    AUTH_FILE,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [{ name: 'auth_token', value: token }],
        },
      ],
    }),
  );

  console.log(`[E2E] Auth state sauvegardé pour ${ADMIN_EMAIL}`);
}

export default globalSetup;
