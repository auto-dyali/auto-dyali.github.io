import type { Page, Route } from '@playwright/test';

const SUPABASE = 'https://nxmsqqoflskfajqrqddw.supabase.co';

export type MockRole = 'saas_admin' | 'manager' | 'employee' | 'client' | 'none';

export function mockSession(role: MockRole = 'saas_admin') {
  const user = {
    id: 'user-mock-1',
    email: role === 'saas_admin' ? 'admin@autodyali.test' : 'user@test.local',
    role: 'authenticated',
    aud: 'authenticated',
  };
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user,
  };
}

export function mockProfile(role: MockRole) {
  if (role === 'none') return [];
  return [{
    id: 'profile-mock-1',
    role,
    full_name: role === 'saas_admin' ? 'Super Admin Test' : 'Utilisateur Test',
    establishment_id: role === 'manager' ? 'est-1' : null,
  }];
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Installe des mocks réseau Supabase (simulation locale isolée).
 * Aucune requête réelle vers Supabase, aucune mutation distante.
 */
export async function installSupabaseMocks(page: Page, opts?: { role?: MockRole; loginOk?: boolean; profileRole?: MockRole }) {
  const role = opts?.role ?? 'saas_admin';
  const loginOk = opts?.loginOk ?? true;
  const profileRole = opts?.profileRole ?? role;

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    // Auth: sign in with password
    if (url.includes('/auth/v1/token') && method === 'POST') {
      if (!loginOk) {
        return fulfillJson(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      }
      return fulfillJson(route, mockSession(profileRole));
    }

    // Auth: get user / session
    if (url.includes('/auth/v1/user') && method === 'GET') {
      if (role === 'none') return fulfillJson(route, { message: 'invalid' }, 401);
      return fulfillJson(route, mockSession(profileRole).user);
    }
    if (url.includes('/auth/v1/logout')) {
      return fulfillJson(route, {}, 204);
    }

    // RPC get_my_profile
    if (url.includes('/rest/v1/rpc/get_my_profile')) {
      return fulfillJson(route, mockProfile(profileRole));
    }

    // Generic RPCs: return safe empty/success mocks (no real mutation)
    if (url.includes('/rest/v1/rpc/')) {
      return fulfillJson(route, []);
    }

    // REST tables: return empty arrays/lists by default
    if (url.includes('/rest/v1/')) {
      if (method === 'GET') return fulfillJson(route, []);
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' });
      return fulfillJson(route, []);
    }

    // Edge functions (e.g. onboard-tenant): block/mocked response, no real call
    if (url.includes('/functions/v1/')) {
      return fulfillJson(route, { error: 'mocked: no remote call' }, 200);
    }

    return fulfillJson(route, {});
  });
}

export async function mockLoginAs(page: Page, role: MockRole = 'saas_admin') {
  await installSupabaseMocks(page, { role, loginOk: true, profileRole: role });
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill('admin@autodyali.test');
  await page.getByPlaceholder(/mot de passe/i).fill('password123');
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
}
