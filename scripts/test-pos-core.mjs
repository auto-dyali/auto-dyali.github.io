// NEW POS CORE — Tests réels des moteurs de vente.
// Exécution : . ~/.local/node-env.sh && node scripts/test-pos-core.mjs
// Aucune dépendance : les moteurs sont purs.

import {
  versCentimes,
  depuisCentimes,
  afMAD,
  repartir,
} from "../src/modules/new-pos/core/money.ts";
import { remiseLigneCent, baseLigneNetteCent, remiseGlobaleEffectiveCent, repartitionRemiseGlobale } from "../src/modules/new-pos/core/discount-engine.ts";
import { tvaLigneCent, groupesTva, tauxValide } from "../src/modules/new-pos/core/tax-engine.ts";
import { calculerTicket } from "../src/modules/new-pos/core/pricing-engine.ts";
import {
  ajouterProduit, ajouterPrestation, ajouterPrestationLibre, majQuantite, majRemiseLigne,
  supprimerLigne, majRemiseGlobale, majClient, panierVide, incrementerQuantite, majPrixUnitaire,
} from "../src/modules/new-pos/core/cart-engine.ts";
import {
  statutDeVente, monnaieARendreCent, totalEncaisseCertainCent, validerReglements,
  reglementsVersBdd, MODE_BDD,
} from "../src/modules/new-pos/core/payment-engine.ts";
import {
  construirePayloadVente, ligneVersItem, empilerOffline, fileCharge, retirerOffline, payloadValide, nouvelleReference,
} from "../src/modules/new-pos/core/sales-engine.ts";

let ok = 0, ko = 0;
function test(nom, fn) {
  try { fn(); ok++; console.log(`  ✓ ${nom}`); }
  catch (e) { ko++; console.log(`  ✗ ${nom} — ${e.message}`); }
}
function egal(a, b, msg) { if (a !== b) throw new Error(`${msg} : attendu ${b}, obtenu ${a}`); }
function vrai(c, msg) { if (!c) throw new Error(msg); }

const ligne = (id, q, pu, opts = {}) => ({
  id, productId: null, serviceId: null, libelle: `L${id}`, quantite: q, prixUnitaireCent: pu,
  remisePourcent: opts.pct ?? 0, remiseCent: opts.fixe ?? 0, tauxTva: opts.tva ?? 20,
});

// ---------------------------------------------------------------- MONEY
console.log("MONEY");
test("versCentimes : nombre, chaîne, virgule,在后缀", () => {
  egal(versCentimes(129.9), 12990, "nombre décimal");
  egal(versCentimes("129,90"), 12990, "chaîne virgule");
  egal(versCentimes(" 129.90 "), 12990, "espaces");
  egal(versCentimes(129.905), 12991, "arrondi demi-cent");
  egal(versCentimes("abc"), 0, "chaîne invalide");
});
test("depuisCentimes / afMAD", () => {
  egal(depuisCentimes(12990), 129.9, "depuis");
  egal(afMAD(12990), "129,90 MAD", "affichage");
});
test("repartir : somme exacte, dernières parts compensées", () => {
  const p = repartir(100, [1, 1, 1]);
  egal(p[0] + p[1] + p[2], 100, "somme");
  egal(Math.abs(p[0] - p[1]) <= 0, true, "parts proches");
});

// ---------------------------------------------------------------- DISCOUNT
console.log("DISCOUNT ENGINE");
test("remise ligne 10 pct", () => {
  egal(remiseLigneCent(ligne("1", 2, 5000, { pct: 10 })), 1000, "10% de 10000 = 1000");
});
test("remise fixe 250 sur ligne quantité 2", () => {
  egal(remiseLigneCent(ligne("1", 2, 5000, { fixe: 250 })), 250, "fixe");
});
test("remise mixte pct+fixe plafonnée au brut", () => {
  egal(remiseLigneCent(ligne("1", 1, 10000, { pct: 10, fixe: 9500 })), 10000, "10% + fixe plafonné");
});
test("base ligne nette", () => {
  egal(baseLigneNetteCent(ligne("1", 2, 5000, { pct: 10 })), 9000, "brut − remise");
});
test("remise globale effective plafonnée au HT brut", () => {
  const lignes = [ligne("1", 1, 8000, { tva: 20 }), ligne("2", 1, 2000, { tva: 0 })];
  egal(remiseGlobaleEffectiveCent(lignes, { pourcent: 0, montantCent: 999999 }), 10000, "plafonnée");
});
test("répartition remise globale : somme exacte + jamais > base ligne", () => {
  const lignes = [ligne("1", 2, 5000, { tva: 20 }), ligne("2", 1, 3000, { tva: 10 }), ligne("3", 1, 2000, { tva: 14 })];
  const remise = { pourcent: 0, montantCent: 1237 };
  const parts = repartitionRemiseGlobale(lignes, remise);
  egal(parts.reduce((s, x) => s + x, 0), 1237, "répartition somme exacte");
  lignes.forEach((l, i) => vrai(parts[i] <= baseLigneNetteCent(l), `part ${i} <= base`));
});

// ---------------------------------------------------------------- TAX
console.log("TAX ENGINE");
test("TVA 20% sur 10000 cent", () => egal(tvaLigneCent(10000, 20), 2000, "20%"));
test("TVA 0% exonérée", () => egal(tvaLigneCent(15000, 0), 0, "0%"));
test("TVA 14% sur base nette", () => egal(tvaLigneCent(10050, 14), 1407, "14% arrondi"));
test("taux validité bornée", () => {
  vrai(tauxValide(0), "0 valide (exonéré)");
  vrai(tauxValide(20), "20 valide");
  vrai(tauxValide(7.5), "7.5 valide (taux configurable)");
  egal(tauxValide(-1), false, "négatif rejeté");
  egal(tauxValide(105), false, "> 100 rejeté");
  egal(tauxValide(NaN), false, "NaN rejeté");
});
test("groupesTva : 2 taux regroupés, tri croissant", () => {
  const gs = groupesTva([{ baseCent: 8000, tauxTva: 20 }, { baseCent: 2000, tauxTva: 0 }]);
  egal(gs.length, 2, "deux groupes");
  egal(gs[0].taux, 0, "premier = 0%");
  egal(gs[1].baseCent, 8000, "base 20%");
});

// ---------------------------------------------------------------- PRICING
console.log("PRICING ENGINE");
test("ticket simple : 2 lignes 2 taux, sans remise", () => {
  const t = calculerTicket([ligne("1", 1, 8000, { tva: 20 }), ligne("2", 1, 2000, { tva: 0 })]);
  egal(t.brutCent, 10000, "brut");
  egal(t.baseHtNetCent, 10000, "base HT");
  egal(t.tvaTotalCent, 1600, "TVA = 8000×20% + 2000×0%");
  egal(t.ttcCent, 11600, "TTC");
  egal(t.resteDuCent, 11600, "reste dû TTC");
});
test("ticket mixte 3 lignes 3 taux : reste dû exact", () => {
  const t = calculerTicket([ligne("1", 2, 5000, { tva: 20 }), ligne("2", 1, 3000, { tva: 10 }), ligne("3", 1, 2000, { tva: 14 })], { pourcent: 0, montantCent: 0 }, 5000);
  egal(t.brutCent, 15000, "brut");
  egal(t.tvaTotalCent, 2000 + 300 + 280, "TVA 3 groupes");
  egal(t.ttcCent, 15000 + t.tvaTotalCent, "TTC");
  egal(t.resteDuCent, t.ttcCent - 5000, "reste après acompte");
});
test("ticket avec remise ligne + remise globale ticket : cohérence totale parfaite", () => {
  const lignes = [ligne("1", 2, 5000, { tva: 20 }), ligne("2", 1, 3000, { tva: 10 }), ligne("3", 1, 2000, { tva: 14 })];
  const t = calculerTicket(lignes, { pourcent: 0, montantCent: 1237 }, 17000);
  egal(t.remiseTotalCent, 1237, "remise totale");
  egal(t.baseHtNetCent + t.remiseTotalCent, t.brutCent, "base + remise = brut");
  // TVA recalculée par ligne nette de remise :
  const t2 = calculerTicket(lignes, { pourcent: 10, montantCent: 0 });
  vrai(t2.remiseGlobaleCent > 0, "remise % globale > 0");
  vrai(Math.abs(t2.ttcCent - (t2.baseHtNetCent + t2.tvaTotalCent)) <= 0, "TTC = base + TVA");
});
test("monnaie exacte sur paiement supérieur", () => {
  const t = calculerTicket([ligne("1", 1, 8000, { tva: 20 })], { pourcent: 0, montantCent: 0 }, 10000);
  egal(t.ttcCent, 9600, "TTC");
  egal(t.monnaieRendueCent, 400, "monnaie 400");
  egal(t.resteDuCent, 0, "reste 0");
});

// ---------------------------------------------------------------- CART
console.log("CART ENGINE");
test("ajout produit", () => {
  const p = { id: "p1", nom: "Filtre", categorie: "filtre", familles: [], prixUnitaireCent: 5000, tauxTva: 20, stock: 10, source: "bdd" };
  let e = panierVide();
  e = ajouterProduit(e, p);
  egal(e.lignes.length, 1, "une ligne");
  e = ajouterProduit(e, p);
  egal(e.lignes.length, 1, "fusion");
  egal(e.lignes[0].quantite, 2, "q = 2");
});
test("refus ajout au-dessus du stock", () => {
  const p = { id: "p1", nom: "Filtre", categorie: "filtre", familles: [], prixUnitaireCent: 5000, tauxTva: 20, stock: 3, source: "bdd" };
  let e = panierVide();
  e = ajouterProduit(e, p, 5); // au-dessus du stock → refusé
  egal(e.lignes.length, 0, "refusé");
  e = ajouterProduit(e, p, 3);
  egal(e.lignes[0].quantite, 3, "accepté à la limite");
});
test("ajout prestation et libre (taux 0 par défaut pour libre)", () => {
  let e = panierVide();
  e = ajouterPrestation(e, { id: "s1", nom: "Vidange", prixUnitaireCent: 15000, tauxTva: 20, source: "bdd" });
  e = ajouterPrestationLibre(e, "Nettoyage jantes", 3000);
  egal(e.lignes.length, 2, "deux lignes");
  egal(e.lignes[1].tauxTva, 0, "libre = 0%");
  egal(e.lignes[1].prixUnitaireCent, 3000, "prix libre");
  egal(e.lignes[0].stocke, false, "prestation non stockée");
});
test("quantité 0 supprime la ligne", () => {
  let e = panierVide();
  e = ajouterPrestationLibre(e, "x", 1000);
  e = majQuantite(e, e.lignes[0].id, 0);
  egal(e.lignes.length, 0, "supprimée");
});
test("+1 sur quantité décimale", () => {
  let e = panierVide();
  e = ajouterPrestationLibre(e, "x", 1000);
  e = majQuantite(e, e.lignes[0].id, 1.5);
  e = incrementerQuantite(e, e.lignes[0].id);
  egal(e.lignes[0].quantite, 2.5, "2.5");
});
test("majRemiseLigne + majRemiseGlobale + suppression", () => {
  let e = panierVide();
  e = ajouterPrestationLibre(e, "a", 10000, 20);
  e = majRemiseLigne(e, e.lignes[0].id, { pourcent: 15 });
  egal(e.lignes[0].remisePourcent, 15, "15%");
  e = majRemiseGlobale(e, { pourcent: 5, montantCent: 0 });
  egal(e.remiseGlobale.pourcent, 5, "globale 5%");
  e = supprimerLigne(e, e.lignes[0].id);
  egal(e.lignes.length, 0, "supprimée");
});
test("majPrixUnitaire jamais négatif", () => {
  let e = panierVide();
  e = ajouterPrestationLibre(e, "x", 1000);
  e = majPrixUnitaire(e, e.lignes[0].id, -500);
  egal(e.lignes[0].prixUnitaireCent, 0, "0");
});
test("majClient → véhicule réinitialisé si incohérent", () => {
  let e = panierVide();
  e = majClient(e, { id: "c1", nomComplet: "A", soldeDuCent: 0 });
  e = { ...e, vehicule: { id: "v1", clientId: "c1", plaque: "1", marque: "m", modele: "x" } };
  e = majClient(e, { id: "c2", nomComplet: "B", soldeDuCent: 0 });
  egal(e.vehicule, null, "véhicule cancel");
});

// ---------------------------------------------------------------- PAYMENT
console.log("PAYMENT ENGINE");
test("statut vente : paid / partial / opened", () => {
  const ttccent = 12000;
  const base = { brutCent: 0, remiseLignesCent: 0, remiseGlobaleCent: 0, remiseTotalCent: 0, baseHtNetCent: 10000, tauxTva: [20], tvaParTaux: [], tvaTotalCent: 2000, ttcCent: ttccent, payeCent: ttccent, resteDuCent: 0, monnaieRendueCent: 0 };
  egal(statutDeVente({ ...base, payeCent: 12000, resteDuCent: 0 }, [{ mode: "especes", montantCent: 12000 }]), "paid", "paid");
  egal(statutDeVente({ ...base, payeCent: 8000, resteDuCent: 4000 }, [{ mode: "especes", montantCent: 8000 }]), "partial", "partial");
  egal(statutDeVente({ ...base, payeCent: 0, resteDuCent: ttccent }, []), "opened", "credit pur");
});
test("chèque NON encaissé n'est pas un encaissement certain", () => {
  egal(totalEncaisseCertainCent([{ mode: "cheque", montantCent: 5000, cheque: { numero: "1", banque: "BMCE", date: "2026-01-01", echeance: "2026-02-01", statut: "en_attente" } }]), 0, "attente = 0");
  egal(totalEncaisseCertainCent([{ mode: "cheque", montantCent: 5000, cheque: { numero: "1", banque: "BMCE", date: "2026-01-01", echeance: "2026-02-01", statut: "encaisse" } }]), 5000, "encaissé");
});
test("virement NON confirmé = pas certain", () => {
  egal(totalEncaisseCertainCent([{ mode: "virement", montantCent: 3000, virement: { reference: "x", confirme: false } }]), 0, "attente");
  egal(totalEncaisseCertainCent([{ mode: "virement", montantCent: 3000, virement: { reference: "x", confirme: true } }]), 3000, "confirmé");
});
test("monnaie à rendre : uniquement espèces", () => {
  egal(monnaieARendreCent(10000, [{ mode: "especes", montantCent: 10050 }]), 50, "espèces seule : monnaie 50");
  egal(monnaieARendreCent(10000, [
    { mode: "visa", montantCent: 3000 },
    { mode: "especes", montantCent: 10500 },
  ]), 3500, "visa 3000 couvre, cash 10500 → monnaie 3500");
  egal(monnaieARendreCent(10000, [{ mode: "visa", montantCent: 10000 }]), 0, "sans espèces → 0");
});
test("validerReglements : chèque sans banque, crédit sans client / sans droit", () => {
  const base = calculerTicket([ligne("1", 1, 10000, { tva: 20 })]);
  const err1 = validerReglements(base, [{ mode: "cheque", montantCent: 12000, cheque: { numero: "", banque: "", date: "", echeance: "", statut: "en_attente" } }], { clientPresente: false, autoriseCredit: false, soldeAvoirCent: 0 });
  vrai(err1.length >= 1, "cheque sans banque err");
  const base2 = calculerTicket([ligne("1", 1, 10000, { tva: 20 })]);
  const err2 = validerReglements(base2, [], { clientPresente: false, autoriseCredit: false, soldeAvoirCent: 0 });
  vrai(err2.length >= 2, "credit sans client + sans droit refusé");
});
test("validerReglements : avoir > solde refusé", () => {
  const base = calculerTicket([ligne("1", 1, 10000, { tva: 20 })]);
  const err = validerReglements(base, [{ mode: "avoir", montantCent: 5000 }], { clientPresente: true, autoriseCredit: false, soldeAvoirCent: 2000 });
  vrai(err.some((m) => m.includes("insuffisant")), "avoir insuffisant");
});
test("mapping BDD", () => {
  egal(MODE_BDD.especes, "cash", "cash");
  egal(MODE_BDD.mastercard, "card", "card");
  egal(MODE_BDD.virement, "transfer", "transfer");
  const bdd = reglementsVersBdd([{ mode: "especes", montantCent: 12345 }]);
  egal(bdd[0].amount, 123.45, "montant décimal");
});

// ---------------------------------------------------------------- SALES ENGINE
console.log("SALES ENGINE");
test("payload complet : cohérence server-like depuis lignes", () => {
  let e = panierVide();
  e = ajouterPrestationLibre(e, "Huile 5W40", 8500, 20);
  e = ajouterPrestationLibre(e, "Main d'œuvre", 5000, 20);
  e = majRemiseGlobale(e, { pourcent: 0, montantCent: 500 });
  e = majClient(e, { id: "c1", nomComplet: "Ahmad", soldeDuCent: 0 });
  const built = construirePayloadVente(e, [{ mode: "especes", montantCent: 15600 }], { payeCent: 15600, soldeAvoirCent: 0 });
  vrai("payload" in built, "payload construite");
  if ("payload" in built) {
    const p = built.payload;
    egal(p.items.length, 2, "2 items");
    egal(p.status, "paid", "statut paid");
    egal(p.payments.length, 1, "1 paiement");
    vrai(p.total > 0 && p.paid_total === p.total, "paid = total");
    vrai(payloadValide(p).length === 0, "payload valide");
  }
});
test("payload : référence unique (payload === retour, jamais deux appels)", () => {
  let e = panierVide();
  e = ajouterPrestationLibre(e, "Test", 1000, 20);
  e = majClient(e, { id: "c1", nomComplet: "A", soldeDuCent: 0 });
  const built = construirePayloadVente(e, [{ mode: "especes", montantCent: 1200 }], { payeCent: 1200, soldeAvoirCent: 0 });
  vrai("payload" in built, "payload construite");
  if ("payload" in built) {
    egal(built.payload.reference, built.reference, "référence payload === référence retournée");
    vrai(/^VNT-/.test(built.reference), "format");
  }
});
test("payloadValide : paid_total > total rejeté + règlements < paid rejeté", () => {
  const base = { reference: "VNT-X", client_id: null, vehicle_id: null, work_order_id: null, subtotal: 100, discount: 0, tax_total: 20, total: 120, paid_total: 130, status: "paid", items: [{ product_id: null, service_id: null, label: "x", quantity: 1, unit_price: 100, tax_rate: 0, discount: 0 }], payments: [{ method: "cash", amount: 130 }] };
  vrai(payloadValide(base).some((m) => m.includes("dépasse le total")), "paid > total rejeté");
  const base2 = { ...base, paid_total: 120, payments: [{ method: "cash", amount: 100 }] };
  vrai(payloadValide(base2).some((m) => m.includes("règlements < paid_total")), "règlements < paid rejeté");
});
test("payload crédit sans client → erreur", () => {
  let e = panierVide();
  e = ajouterPrestationLibre(e, "x", 1000, 20);
  const built = construirePayloadVente(e, [], { payeCent: 0, soldeAvoirCent: 0 });
  vrai("erreur" in built, "erreur crédit sans client");
});
test("panier vide → erreur (jamais auto-declic)", () => {
  const built = construirePayloadVente(panierVide(), [], { payeCent: 0, soldeAvoirCent: 0 });
  vrai("erreur" in built, "erreur");
});
test("items : remise ligne purement montant", () => {
  const l = ligne("1", 2, 5000, { pct: 10, tva: 20 });
  const it = ligneVersItem(l);
  egal(it.discount, 10, "1000 cent = 10 MAD");
  egal(it.unit_price, 50, "unit_price MAD");
  egal(it.tax_rate, 20, "taux");
});
test("file offline : empiler / retirer / jamais doublon", () => {
  fileCharge().forEach((c) => retirerOffline(c.reference));
  empilerOffline({ reference: "VNT-1", items: [], payments: [], client_id: null, vehicle_id: null, work_order_id: null, subtotal: 0, discount: 0, tax_total: 0, total: 0, paid_total: 0, status: "opened" }, "VNT-1");
  const n = fileCharge().length;
  empilerOffline({ reference: "VNT-1", items: [], payments: [], client_id: null, vehicle_id: null, work_order_id: null, subtotal: 0, discount: 0, tax_total: 0, total: 0, paid_total: 0, status: "opened" }, "VNT-1");
  egal(fileCharge().length, n, "pas de doublon");
  const ref = nouvelleReference();
  vrai(/^VNT-\d{4}-\d{4}-\d{6}-/.test(ref), "format référence");
  retirerOffline("VNT-1");
  egal(fileCharge().length, n - 1, "retiré");
});

console.log(`\nRÉSULTAT : ${ok} réussi(s), ${ko} échec(s)`);
if (ko > 0) process.exit(1);
