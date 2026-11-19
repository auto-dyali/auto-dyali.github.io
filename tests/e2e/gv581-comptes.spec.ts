import { test, expect, type Page } from '@playwright/test';

/** GV5 §81 — Actions de gestion des comptes : rôles et cas limites (staging réel). */
const URL = 'https://yocufscgninxiihwiepa.supabase.co';
const KEY = 'sb_publishable_SkPOqfTxZ1drLBK8sxu83Q_6yr0OB7d';

async function jeton(email: string, motDePasse: string): Promise<string> {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  const j = await r.json() as { access_token?: string };
  if (!j.access_token) throw new Error(`Connexion impossible pour ${email}`);
  return j.access_token;
}

async function rpc(token: string | null, nom: string, corps: unknown) {
  const h: Record<string, string> = { 'Content-Type': 'application/json', apikey: KEY };
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(`${URL}/rest/v1/rpc/${nom}`, { method: 'POST', headers: h, body: JSON.stringify(corps) });
  return { statut: r.status, corps: (await r.text()).slice(0, 220) };
}

let SA = '';
let compteA = '';
let compteB = '';
let compteBNom = '';
let compteBSlug = '';

test.beforeAll(async () => {
  SA = await jeton('superadmin.ui@autodyali-staging.local', 'SuperAdminUI2026!');
  const suffixe = Date.now();
  for (const [cle, slug] of [['A', `actions-a-${suffixe}`], ['B', `actions-b-${suffixe}`]] as const) {
    const r = await fetch(`${URL}/rest/v1/establishments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${SA}`, Prefer: 'return=representation' },
      body: JSON.stringify({
        name: `Compte Actions ${cle} ${suffixe}`, slug, currency: 'MAD', timezone: 'Africa/Casablanca',
        plan: 'standard', is_active: true, professional_id: `ADY-PRO-${cle}${String(suffixe).slice(-4)}`,
      }),
    });
    const j = await r.json() as { id?: string }[];
    if (!j[0]?.id) throw new Error(`Création fixture impossible: ${r.status}`);
    if (cle === 'A') compteA = j[0].id;
    else { compteB = j[0].id; compteBNom = `Compte Actions B ${suffixe}`; compteBSlug = slug; }
  }
});

async function connexionSA(page: Page) {
  await page.goto('/connexion/');
  await page.getByPlaceholder(/email/i).fill('superadmin.ui@autodyali-staging.local');
  await page.getByPlaceholder(/mot de passe/i).fill('SuperAdminUI2026!');
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await expect(page).toHaveURL(/\/super-admin/, { timeout: 20000 });
}

test.describe('GV5 §81 — Gestion des comptes professionnels', () => {
  test.beforeEach(() => test.setTimeout(120_000));

  test('menu Actions complet et accès « Identifiants / MDP »', async ({ page }) => {
    await connexionSA(page);
    await page.goto('/super-admin/entreprises/');
    const ligne = page.getByRole('row').filter({ hasText: 'Garage Unification' }).first();
    await expect(ligne).toBeVisible({ timeout: 20000 });
    await ligne.getByRole('button', { name: /Actions pour/ }).click();
    const menu = page.getByRole('menu').first();
    for (const a of ['Consulter', 'Modifier', 'Identifiants / MDP', 'Renouveler', 'Suspendre', 'Archiver']) {
      await expect(menu.getByRole('menuitem', { name: a })).toBeVisible();
    }
    await expect(menu.getByRole('menuitem', { name: 'Supprimer définitivement' })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Identifiants / MDP' }).click();
    await expect(page.getByRole('tab', { name: 'Manager' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('dialog').getByText('Compte Manager')).toBeVisible();
  });

  test('rôles : anonyme et Manager refusés, Super Admin autorisé', async () => {
    const mgr = await jeton('manager.interface.1795014089951@garage-interface-test.local', 'ManagerFinal2026!');
    const operations: [string, unknown][] = [
      ['admin_get_abonne_details', { p_id: compteB }],
      ['admin_set_permissions', { p_establishment_id: compteB, p_role: 'manager', p_permissions: [] }],
      ['admin_update_establishment', { p_id: compteB, p_name: 'X', p_slug: 'x', p_legal_name: '', p_activity_type: '', p_address: '', p_city: '', p_region: '', p_phone: '', p_email: '', p_notes: '', p_professional_id: '' }],
      ['admin_purge_establishment', { p_id: compteB }],
    ];
    for (const [nom, corps] of operations) {
      expect((await rpc(null, nom, corps)).statut, `anon ${nom}`).toBe(401);
      expect((await rpc(mgr, nom, corps)).statut, `manager ${nom}`).toBe(400);
      if (nom === 'admin_purge_establishment') continue; // conservé pour le 3ᵉ test
      const args = nom === 'admin_update_establishment'
        ? { ...corps as object, p_name: compteBNom, p_slug: compteBSlug }
        : corps;
      expect((await rpc(SA, nom, args)).statut, `sa ${nom}`).toBe(200);
    }
  });

  test('suppression définitive : archivage requis puis succès sur compte vide', async () => {
    const avantArchive = await rpc(SA, 'admin_purge_establishment', { p_id: compteA });
    expect(avantArchive.statut).toBe(400);
    expect(avantArchive.corps).toMatch(/Archivage obligatoire/);
    expect([200, 204]).toContain((await rpc(SA, 'admin_archive_establishment', { p_id: compteA, p_archive: true })).statut);
    const reussi = await rpc(SA, 'admin_purge_establishment', { p_id: compteA });
    expect(reussi.statut).toBe(200);
    expect(reussi.corps).toMatch(/audit_conserve/);
  });
});
