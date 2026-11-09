// AUTO DYALI — Tests finance + catalogue (Phase 7 + Phase 2).
// Exécution : . ~/.local/node-env.sh && node scripts/test-finance.mjs

import { resumeFinance, libelleResultat } from "../src/lib/finance.ts";
import { sousCategorie, doublonsProduits } from "../src/modules/new-pos/services/products.service.ts";

let ok = 0, ko = 0;
function test(nom, fn) {
  try { fn(); ok++; console.log(`  ✓ ${nom}`); }
  catch (e) { ko++; console.log(`  ✗ ${nom} — ${e.message}`); }
}
function egal(a, b, msg) { if (a !== b) throw new Error(`${msg} : attendu ${b}, obtenu ${a}`); }
function vrai(c, msg) { if (!c) throw new Error(msg); }

console.log("FINANCE");
test("sans coût : résultat net null (jamais de faux bénéfice)", () => {
  const r = resumeFinance([{ quantity: 2, unitPrice: 100, taxRate: 20, discount: 0, coutUnitaire: null }], 50);
  egal(r.chiffreAffairesHT, 200, "CA HT");
  egal(r.coutMarchandises, null, "coût inconnu");
  egal(r.margeBrute, null, "marge inconnue");
  egal(r.resultatNet, null, "résultat net non calculable");
  vrai(libelleResultat(r).includes("pas un bénéfice net"), "libellé honnête");
});
test("avec coût historique : marge brute et résultat net calculés", () => {
  const r = resumeFinance([{ quantity: 2, unitPrice: 100, taxRate: 20, discount: 10, coutUnitaire: 60 }], 30);
  egal(r.chiffreAffairesHT, 190, "CA HT net de remise");
  egal(r.coutMarchandises, 120, "coût");
  egal(r.margeBrute, 70, "marge brute");
  egal(r.resultatNet, 40, "résultat net");
});

console.log("CATALOGUE");
test("sous-catégories filtration et lubrifiants", () => {
  egal(sousCategorie({ categorie: "filtre", nom: "Filtre à huile Mahle" }), "Filtre à huile", "huile");
  egal(sousCategorie({ categorie: "filtre", nom: "Filtre à air" }), "Filtre à air", "air");
  egal(sousCategorie({ categorie: "lubrifiant", nom: "Quartz 5W-30" }), "Huiles moteur", "huiles");
  egal(sousCategorie({ categorie: "pneumatique", nom: "Pneu Michelin" }), "Pneus", "pneus");
});
test("doublons SKU / code-barres détectés", () => {
  const d = doublonsProduits([{ reference: "A1" }, { reference: "A1" }, { codeBarres: "123" }, { codeBarres: "123" }, { reference: "B2" }]);
  egal(d.length, 2, "deux doublons");
});

console.log(`\nRÉSULTAT : ${ok} réussi(s), ${ko} échec(s)`);
if (ko > 0) process.exit(1);
