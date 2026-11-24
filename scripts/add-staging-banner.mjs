/**
 * GV5 §106 — Marque l'artefact de préversion comme STAGING.
 * Injecte noindex et un bandeau visible dans toutes les pages statiques
 * générées, sans modifier le code source de l'application.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const racine = process.argv[2] ?? "out";
const BANDEAU =
  '<div style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#7a1f1f;color:#fff;text-align:center;font:600 14px/32px sans-serif;letter-spacing:.08em">STAGING — DONNÉES DE TEST</div>';

let count = 0;
function parcourir(dossier) {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      parcourir(chemin);
    } else if (entree.endsWith(".html")) {
      let html = readFileSync(chemin, "utf8");
      if (!html.includes('name="robots"')) {
        html = html.replace("</head>", '<meta name="robots" content="noindex,noarchive">\n</head>');
      }
      if (!html.includes("STAGING — DONNÉES DE TEST")) {
        html = html.replace("</body>", `${BANDEAU}\n</body>`);
      }
      writeFileSync(chemin, html);
      count++;
    }
  }
}

parcourir(racine);
console.log(`Pages marquées STAGING : ${count}`);
