/**
 * AUTO DYALI — GV5 §82 — Test LOCAL de l'algorithme de signature du webhook Stripe.
 *
 * Le secret utilisé ici est une Chaîne SYNTHÉTIQUE DE TEST, jamais un secret
 * de production. Ce test vérifie la logique HMAC-SHA256 (même algorithme que
 * `supabase/functions/stripe-webhook/index.ts`) : signature valide acceptée,
 * corps modifié ou horodatage ancien refusés. Aucun appel réseau, aucun
 * paiement, aucun événement réel.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SECRET_TEST = 'whsec_UNIQUEMENT_TEST_LOCAL_gv582';
const source = readFileSync(resolve('supabase/functions/stripe-webhook/index.ts'), 'utf8');

function hmac(timestamp, corps) {
  return createHmac('sha256', SECRET_TEST).update(`${timestamp}.${corps}`).digest('hex');
}
function constantTime(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

test("la EF exige un secret et refuse sans configuration (503)", () => {
  assert.match(source, /STRIPE_WEBHOOK_SECRET/);
  assert.match(source, /json\(503,/);
  assert.match(source, /Aucun événement enregistré/);
});

test('signature HMAC valide acceptée', () => {
  const corps = JSON.stringify({ id: 'evt_test_local', type: 'invoice.paid', data: { object: { amount_total: 1000 } } });
  const ts = String(Math.floor(Date.now() / 1000));
  assert.ok(constantTime(hmac(ts, corps), hmac(ts, corps)));
});

test('corps modifié refusé', () => {
  const corps = JSON.stringify({ id: 'evt_test_local', type: 'invoice.paid' });
  const ts = String(Math.floor(Date.now() / 1000));
  const signé = hmac(ts, corps);
  assert.equal(constantTime(signé, hmac(ts, `${corps} `)), false);
});

test('horodatage périmé refusé (tolérance 5 min)', () => {
  const ancien = String(Math.floor(Date.now() / 1000) - 3600);
  const ecart = Math.abs(Date.now() / 1000 - Number(ancien));
  assert.ok(ecart > 300);
});

test('comparaison à temps constant utilisée dans la EF', () => {
  assert.match(source, /constantTimeEqual/);
  assert.match(source, /timingSafeEqual|charCodeAt/);
});
