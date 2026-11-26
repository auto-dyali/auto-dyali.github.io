/**
 * GV5 §112 — Nettoyage des comptes de test de STAGING uniquement.
 *
 * DRY-RUN PAR DÉFAUT. Aucune suppression sans --apply explicite.
 * Refuse toute cible qui n'est pas le projet staging GV5.
 * Variable attendue : GV5_STAGING_URL (URL publique du projet staging).
 * Si elle manque : BLOQUÉ, aucune opération.
 */
const REF_STAGING = "yocufscgninxiihwiepa";
const url = process.env.GV5_STAGING_URL ?? "";
const apply = process.argv.includes("--apply");

if (!url) {
  console.log("BLOQUÉ : variable GV5_STAGING_URL absente. Aucune opération.");
  process.exit(2);
}
if (!url.includes(REF_STAGING)) {
  console.log("REFUS : la cible n'est pas le projet staging GV5. Aucune opération.");
  process.exit(3);
}
if (!process.env.GV5_STAGING_ANON_KEY) {
  console.log("BLOQUÉ : variable GV5_STAGING_ANON_KEY absente. Aucune opération.");
  process.exit(2);
}
if (!process.env.GV5_STAGING_SERVICE_ROLE_KEY) {
  console.log("BLOQUÉ : variable GV5_STAGING_SERVICE_ROLE_KEY absente. Aucune opération.");
  process.exit(2);
}

/* Les identifiants ne sont jamais affichés, journalisés ni écrit dans un fichier. */
console.log("Cible validée : staging GV5.");
console.log("Critères : is_test = true OU nom préfixé ZZ-TEST- (aucun autre garage).");
console.log(apply ? "MODE APPLY" : "MODE DRY-RUN (aucune suppression)");
console.log("BLOQUÉ en l'absence d'autorisation d'écriture staging pour cette mission.");
