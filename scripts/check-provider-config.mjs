/**
 * AUTO DYALI — GV5 §76 — Contrôle de disponibilité des fournisseurs
 *
 * Affiche UNIQUEMENT les noms des paramètres présents/absents.
 * Aucune valeur de secret n'est lue, journalisée ou affichée.
 * Les secrets des Edge Functions résident dans la configuration Supabase,
 * pas dans ce dépôt : le script contrôle l'environnement local disponible et
 * documente les paramètres attendus par les EF `onboard-tenant` / `send-invitation`.
 * Un paramètre absent côté serveur n'est pas une erreur applicative : l'EF
 * renvoie un statut `non_configure` explicite, jamais un succès simulé.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ATTENDUS = {
  "E-mail (Resend)": ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"],
  "WhatsApp (Meta)": [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_TEMPLATE_NAME",
    "WHATSAPP_TEMPLATE_LANG",
    "WHATSAPP_API_VERSION",
  ],
  "Lien d'activation": ["ACTIVATION_BASE_URL"],
  "Supabase (serveur EF)": ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
};

function lireEnvLocal() {
  try {
    const texte = readFileSync(resolve(".env.local"), "utf8");
    const resultat = {};
    for (const ligne of texte.split("\n")) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) resultat[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    return resultat;
  } catch {
    return {};
  }
}

const env = { ...process.env, ...lireEnvLocal() };
let manquants = 0;

for (const [fournisseur, params] of Object.entries(ATTENDUS)) {
  const presents = params.filter((n) => Boolean(env[n]?.trim()));
  const absents = params.filter((n) => !env[n]?.trim());
  manquants += absents.length;
  console.log(`\n${fournisseur}`);
  console.log(`  présents : ${presents.length ? presents.join(", ") : "aucun"}`);
  console.log(`  absents  : ${absents.length ? absents.join(", ") : "aucun"}`);
}

console.log("\nStatut :", manquants === 0 ? "tous les paramètres sont renseignés" : `${manquants} paramètre(s) manquant(s)`);
console.log("Rappel : en l'absence de secret, les EF renvoient `non_configure` et n'envoient rien.");
if (manquants > 0) process.exitCode = 2;
