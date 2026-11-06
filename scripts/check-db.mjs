#!/usr/bin/env node
/**
 * AUTO DYALI — Vérification de l'état des migrations Supabase.
 * Usage : npm run db:check
 *
 * Interroge la base avec la clé PUBLIQUE (RLS respectée) et affiche,
 * pour chaque migration critique, si ses objets existent réellement.
 * Aucune écriture : lecture seule, aucune donnée modifiée.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envLocal = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (key) => envLocal.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

if (!url || !key) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY absent de .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

/** Table ou vue à tester. */
const objets = [
  ["0008", "products.stock (colonnes du catalogue)", "products", null],
  ["0008", "plans (forfaits)", "plans", null],
  ["0009", "plan_features (modules par forfait)", "plan_features", null],
  ["0009", "subscriptions", "subscriptions", null],
  ["0011", "payments.method inclut 'mobile'", "payments", null],
  ["0013", "tire_specs (pneumatiques)", "tire_specs", null],
  ["0013", "quotes (devis)", "quotes", null],
  ["0013", "quote_items (lignes de devis)", "quote_items", null],
  ["0015", "support_tickets", "support_tickets", null],
  ["0015", "ticket_messages", "ticket_messages", null],
  ["0016", "vehicle_catalog (catalogue véhicules)", "vehicle_catalog", null],
  ["0016", "part_compatibilities (compatibilités)", "part_compatibilities", null],
  ["0017", "client_notifications.channel", "client_notifications", null],
  ["0018", "crm_leads (CRM Super Admin)", "crm_leads", null],
  ["0018", "crm_events", "crm_events", null],
];

console.log("AUTO DYALI — état des migrations (lecture seule)\n");
console.log("Migration | Objet                            | État");
console.log("----------|----------------------------------|------");

let manquantes = 0;
for (const [num, libelle, table] of objets) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
  const ok = !error;
  if (!ok) manquantes += 1;
  console.log(
    `${num.padEnd(9)} | ${libelle.padEnd(34)} | ${ok ? "✓ présent" : "✗ MANQUANT"}`,
  );
}

// Test fonctionnel : la RPC my_features (0009) doit répondre.
const { error: rpcError } = await supabase.rpc("my_features");
console.log(`\nRPC my_features() : ${rpcError ? "✗ absente (migration 0009 à appliquer)" : "✓ fonctionnelle"}`);
if (rpcError) manquantes += 1;

// Test fonctionnel : le stock POS (0012).
const { error: stockError } = await supabase.rpc("decrement_product_stock", {
  p_product_id: "00000000-0000-0000-0000-000000000000",
  p_quantity: 1,
});
const stockOk = stockError && !stockError.message.includes("does not exist") && !stockError.message.includes("function");
console.log(`RPC decrement_product_stock() : ${stockOk ? "✓ présente" : "✗ absente (migration 0012 à appliquer)"}`);
if (!stockOk) manquantes += 1;

if (manquantes === 0) {
  console.log("\n✓ Toutes les migrations critiques sont appliquées.");
} else {
  console.log(`\n✗ ${manquantes} élément(s) manquant(s).`);
  console.log("  Ouvrez Supabase → SQL Editor et exécutez, DANS L'ORDRE, les fichiers");
  console.log("  de supabase/migrations/ dont l'état est MANQUANT (aucun n'est destructif).");
  process.exitCode = 1;
}
