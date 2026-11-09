// AUTO DYALI — Tests stock/achats + atelier + CRM (Phases 3, 4, 5).
// Exécution : . ~/.local/node-env.sh && node scripts/test-metier.mjs

import { validerReceptionItem, statutLigneReception, commandeEntièrementRecue } from "../src/lib/stock.ts";
import { statutMetierAtelier } from "../src/lib/atelier.ts";
import { prochaineEcheance } from "../src/lib/crm.ts";

let ok = 0, ko = 0;
function test(nom, fn) {
  try { fn(); ok++; console.log(`  ✓ ${nom}`); }
  catch (e) { ko++; console.log(`  ✗ ${nom} — ${e.message}`); }
}
function egal(a, b, msg) { if (a !== b) throw new Error(`${msg} : attendu ${b}, obtenu ${a}`); }
function vrai(c, msg) { if (!c) throw new Error(msg); }

console.log("STOCK / ACHATS");
test("quantité reçue négative rejetée", () => vrai(validerReceptionItem(10, -1).length > 0, "rejet négatif"));
test("quantité reçue > commandée rejetée", () => vrai(validerReceptionItem(10, 11).length > 0, "rejet dépassement"));
test("statuts de ligne", () => {
  egal(statutLigneReception(10, 0), "non_recue", "non reçue");
  egal(statutLigneReception(10, 4), "partielle", "partielle");
  egal(statutLigneReception(10, 10), "recue", "reçue");
});
test("commande entièrement reçue seulement si chaque ligne l'est", () => {
  egal(commandeEntièrementRecue([{ quantity: 5, received_quantity: 5 }, { quantity: 3, received_quantity: 3 }]), true, "entièrement reçue");
  egal(commandeEntièrementRecue([{ quantity: 5, received_quantity: 5 }, { quantity: 3, received_quantity: 1 }]), false, "pas entièrement (partielle)");
  egal(commandeEntièrementRecue([]), false, "vide non reçue");
});

console.log("ATELIER");
test("statuts SQL mappés au modèle métier", () => {
  egal(statutMetierAtelier("pending"), "received", "pending");
  egal(statutMetierAtelier("in_progress"), "in_progress", "in_progress");
  egal(statutMetierAtelier("waiting_parts"), "waiting_parts", "waiting_parts");
  egal(statutMetierAtelier("done"), "completed", "done");
  egal(statutMetierAtelier("delivered"), "completed", "delivered");
});

console.log("CRM");
test("prochaine échéance = dernière intervention + 3 mois (pas création client)", () => {
  const d = prochaineEcheance("2026-01-15T10:00:00Z", null, null);
  egal(d.slice(0, 7), "2026-04", "3 mois après intervention");
  const vide = prochaineEcheance(null, null, null);
  egal(vide, null, "sans intervention => null");
});

console.log(`\nRÉSULTAT : ${ok} réussi(s), ${ko} échec(s)`);
if (ko > 0) process.exit(1);
