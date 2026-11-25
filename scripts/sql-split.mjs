/**
 * Découpe un fichier SQL en instructions séparées, en respectant les corps
 * dollar-quotés ($$ ... $$) des functions PL/pgSQL et les blocs DO.
 * Utilisé par la CI pour exécuter des migrations sur la base locale via
 * `supabase db query --local --file=...`, qui n'accepte qu'une instruction.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [, , entree, dossier] = process.argv;
if (!entree || !dossier) {
  console.error("usage: node scripts/sql-split.mjs <fichier.sql> <dossier_sortie>");
  process.exit(2);
}

const sql = readFileSync(entree, "utf8").replace(/^\s*--.*$/gm, "");
const instructions = [];
let courant = "";
let dollar = false;

for (const ligne of sql.split("\n")) {
  courant += ligne + "\n";
  const nb = (ligne.match(/\$\$/g) ?? []).length;
  if (nb % 2 === 1) dollar = !dollar;
  if (!dollar && ligne.trim().endsWith(";")) {
    const nettoye = courant.trim();
    if (nettoye) instructions.push(nettoye);
    courant = "";
  }
}
if (courant.trim()) instructions.push(courant.trim());

mkdirSync(dossier, { recursive: true });
for (const f of readdirSync(dossier)) {
  if (f.endsWith(".sql")) {
    // le dossier est dédié à ce fichier dans la CI ; on nettoie son contenu.
  }
}
instructions.forEach((st, i) => {
  writeFileSync(join(dossier, `${String(i + 1).padStart(4, "0")}.sql`), st + "\n");
});
console.log(`${entree}: ${instructions.length} instruction(s)`);
