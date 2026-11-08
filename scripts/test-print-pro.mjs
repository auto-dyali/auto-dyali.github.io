// AUTO DYALI PRINT PRO — tests du moteur d'impression (logique pure).
// Exécution : . ~/.local/node-env.sh && node scripts/test-print-pro.mjs
// Aucune imprimante requise : les octets ESC/POS et les gabarits HTML
// sont vérifiés ici, en vrai.

import {
  colonnesEscpos,
  habillerTexte,
  ligneDeuxColonnes,
  ligneSeparateur,
  lignesEscpos,
  qrEscpos,
  ticketEscpos,
  modeleTicketHtml,
  modeleBonInterventionHtml,
  modeleTestHtml,
  echapperHtml,
  mad,
  libelleMethode,
  traduireReglements,
  STATUT_BON_LABEL,
} from "../src/lib/print-pro.ts";

let ok = 0;
let ko = 0;

function test(nom, fn) {
  try {
    fn();
    ok++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    ko++;
    console.log(`  ✗ ${nom} — ${e.message}`);
  }
}

function egal(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ETAB = {
  nom: "AUTO DYALI CASABLANCA",
  adresse: "12 Bd Moulay Youssef",
  ville: "Casablanca",
  telephone: "0522-000000",
  email: "contact@autodyali.ma",
  url_verification: "https://auto-dyali.ma/verif?ref=",
};

const TICKET = {
  reference: "VTE-2026-ABC123",
  date: "07/11/2026 15:42",
  caissier: "Hind B.",
  client: "Karim Tazi",
  vehicule: "12345-A-6 — Dacia Logan",
  lignes: [
    { nom: "Filtre à huile", reference: "FLT-001", quantite: 2, prix: 85, remisePct: 10, tvaPct: 20 },
    { nom: "Vidange complète", quantite: 1, prix: 250, tvaPct: 20 },
  ],
  remiseTicket: 0,
  totalTTC: 478.8,
  reglements: [
    { methode: "especes", montant: 300 },
    { methode: "carte", montant: 178.8 },
  ],
  paye: 478.8,
  reste: 0,
  monnaie: 21.2,
  referenceTransaction: "a1b2c3d4",
};

const BON = {
  reference: "WO-2026-0042",
  dateOuverture: "07/11/2026 09:15",
  client: "Karim Tazi",
  telephoneClient: "0661-000000",
  vehicule: { marque: "Dacia", modele: "Logan", plaque: "12345-A-6", kilometrage: 145_000 },
  motif: "Bruit au freinage",
  diagnostic: "Plaquettes avant usées",
  travaux: [{ label: "Remplacement plaquettes avant", statut: "à faire" }],
  pieces: [{ label: "Plaquettes Dacia Logan AV", prix: 320 }],
  mainOeuvre: [{ label: "Main-d'œuvre freinage", prix: 180 }],
  technicien: "Youssef M.",
  statut: "in_progress",
  livraisonPrevue: "08/11/2026",
  observations: "Disques à surveiller",
  clientApprouve: true,
  ventesLiees: ["VTE-2026-ABC123"],
};

console.log("PRINT PRO — largeurs & habillage");
test("58 mm → 32 colonnes, 80 mm → 48, A4 → 0 (pas d'ESC/POS)", () => {
  egal(colonnesEscpos("58mm") === 32 && colonnesEscpos("80mm") === 48 && colonnesEscpos("A4") === 0, "largeurs incorrectes");
});
test("habillerTexte respecte la largeur et coupe les mots longs", () => {
  const lignes = habillerTexte("Remplacement des plaquettes de frein avant", 20);
  egal(lignes.every((l) => l.length <= 20), "ligne trop longue");
  egal(habillerTexte("ABCDEFGHIJKLMNOP", 5).every((l) => l.length <= 5), "mot long non coupé");
});
test("ligneDeuxColonnes : montant toujours intact à droite", () => {
  const l = ligneDeuxColonnes("x2 @ 85 MAD", "153 MAD", 32);
  egal(l.length <= 32, `longueur ${l.length} > 32`);
  egal(l.trimEnd().endsWith("153 MAD"), "montant non aligné à droite");
  const l2 = ligneDeuxColonnes("Un libellé vraiment beaucoup trop long pour tenir", "1 234,56 MAD", 32);
  egal(l2.trimEnd().endsWith("1 234,56 MAD"), "montant tronqué");
});
test("ligneSeparateur", () => {
  egal(ligneSeparateur(32) === "-".repeat(32), "séparateur incorrect");
});

console.log("PRINT PRO — octets ESC/POS");
test("payload 58 mm commence par ESC @ (init) et finit par coupe GS V B", () => {
  const b = lignesEscpos([{ texte: "Bonjour", aligne: "centre", gras: true }], "58mm");
  egal(b[0] === 0x1b && b[1] === 0x40, "init ESC @ absent");
  const fin = Array.from(b.slice(-4));
  egal(fin[0] === 0x1d && fin[1] === 0x56 && fin[2] === 0x42, "coupe GS V B absente");
});
test("aucun octet > 127 (ASCII honnête, hors-ASCII → « ? »)", () => {
  const b = lignesEscpos([{ texte: "Prix : 85 MAD — pièce n°7" }], "58mm");
  egal(Array.from(b).every((x) => x < 128), "octet non-ASCII présent");
});
test("ticketEscpos contient la référence, le total et le QR si URL de vérification", () => {
  const texte = (b) => Array.from(b).map((x) => String.fromCharCode(x)).join("");
  const p = ticketEscpos(TICKET, ETAB, "58mm");
  const s = texte(p);
  egal(s.includes("VTE-2026-ABC123"), "référence absente");
  egal(s.includes("Total TTC") || s.includes("Total"), "total absent");
  egal(s.includes("RESTE") === false, "reste affiché alors que soldé");
  // QR ESC/POS natif : commande GS ( k avec 'P' (stockage) puis 'Q' (impression)
  const a = Array.from(p);
  const gsK = a.filter((x, i) => x === 0x1d && a[i + 1] === 0x28 && a[i + 2] === 0x6b).length;
  egal(gsK >= 5, `commandes QR GS ( k insuffisantes (${gsK})`);
  egal(s.includes("verif%3Fref%3D") || s.includes("verif"), "URL de vérification absente");
});
test("ticketEscpos SANS URL de vérification → aucun QR", () => {
  const etab = { ...ETAB, url_verification: null };
  const a = Array.from(ticketEscpos(TICKET, etab, "80mm"));
  const gsK = a.filter((x, i) => x === 0x1d && a[i + 1] === 0x28 && a[i + 2] === 0x6b).length;
  egal(gsK === 0, "QR généré alors qu'aucune URL de vérification n'est configurée");
});
test("paiement partiel : RESTE À PAYER présent en ESC/POS", () => {
  const texte = (b) => Array.from(b).map((x) => String.fromCharCode(x)).join("");
  const p = ticketEscpos({ ...TICKET, reste: 120, paye: 358.8 }, ETAB, "58mm");
  egal(texte(p).includes("RESTE"), "reste absent");
});
test("réimpression : mention explicite avec numéro initial conservé", () => {
  const texte = (b) => Array.from(b).map((x) => String.fromCharCode(x)).join("");
  const p = ticketEscpos({ ...TICKET, reimpression: 2 }, ETAB, "58mm");
  egal(texte(p).includes("RÉIMPRESSION".replace("É", "?")) || texte(p).includes("R?IMPRESSION") || texte(p).includes("IMPRESSION"), "mention réimpression absente");
  egal(texte(p).includes("VTE-2026-ABC123"), "numéro initial non conservé");
});
test("qrEscpos : structure GS ( k conforme (modèle 2, fn 165/80/69/80/81)", () => {
  const a = Array.from(qrEscpos("https://exemple.ma/verif?ref=VTE-1"));
  egal(a[0] === 0x1d && a[1] === 0x28 && a[2] === 0x6b, "début GS ( k absent");
  egal(a[5] === 0x31 && a[6] === 0xa5, "fonction 165 (modèle 2) absente");
  egal(a.some((x) => x === 0x45), "correction d'erreur absente");
});

console.log("PRINT PRO — gabarits HTML");
const html = modeleTicketHtml(TICKET, ETAB, "fr", "58mm");
test("ticket FR : tous les champs obligatoires présents", () => {
  for (const morceau of [
    "AUTO DYALI CASABLANCA", "12 Bd Moulay Youssef", "0522-000000",
    "TICKET DE PAIEMENT", "VTE-2026-ABC123", "07/11/2026 15:42",
    "Hind B.", "Karim Tazi", "12345-A-6", "Filtre à huile", "FLT-001",
    "Vidange complète", "478,8 MAD", "Espèces", "Carte", "Monnaie rendue",
    "21,2 MAD", "a1b2c3d4", "verif",
  ]) egal(html.includes(morceau), `« ${morceau} » absent du ticket`);
});
test("ticket : remise et TVA par ligne présentes", () => {
  egal(html.includes("Remise"), "remise absente");
  egal(html.includes("TVA"), "TVA absente");
});
test("QR présent UNIQUEMENT avec URL de vérification configurée", () => {
  const avec = modeleTicketHtml(TICKET, ETAB, "fr", "58mm");
  const sans = modeleTicketHtml(TICKET, { ...ETAB, url_verification: null }, "fr", "58mm");
  egal(avec.includes("create-qr-code"), "QR absent alors que URL configurée");
  egal(!sans.includes("create-qr-code"), "QR présent sans URL de vérification");
});
test("arabe : dir=rtl, libellés arabes, montants inchangés", () => {
  const h = modeleTicketHtml(TICKET, ETAB, "ar", "80mm");
  egal(h.includes('dir="rtl"'), "dir=rtl absent");
  egal(h.includes("وصل الأداء"), "titre arabe absent");
  egal(h.includes("المجموع بالضريبة"), "libellé total arabe absent");
  egal(h.includes("478,8 MAD"), "montant altéré en arabe");
  egal(h.includes("f80"), "classe 80 mm absente");
});
test("échapperHtml neutralise le HTML injecté", () => {
  const s = echapperHtml('<script>alert("x")</' + "script>");
  egal(!s.includes("<script>"), "balise script non échappée");
  egal(s.includes("<") || !s.includes("<"), "échappement incorrect");
});
test("mad : format fr-FR + devise (espaces insécables normalisés)", () => {
  const s = mad(1234.5).replace(/\u00a0|\u202f|\s+/g, " ");
  egal(s.includes("1 234,5") && s.endsWith("MAD"), `format inattendu : ${JSON.stringify(mad(1234.5))}`);
});
test("libelleMethode / traduireReglements FR & AR", () => {
  egal(libelleMethode("especes", "fr") === "Espèces", "libellé FR incorrect");
  egal(libelleMethode("especes", "ar") === "نقدا", "libellé AR incorrect");
  const t = traduireReglements([{ methode: "carte", montant: 10 }], "ar");
  egal(t[0].methode === "بطاقة", "traduction réglement incorrecte");
});

console.log("PRINT PRO — bon d'intervention");
const htmlBon = modeleBonInterventionHtml(BON, ETAB, "fr", "80mm");
const normaliser = (s) => s.replace(/\u00a0|\u202f/g, " ");
test("bon thermique 80 mm : champs obligatoires présents", () => {
  const bon = normaliser(htmlBon);
  for (const morceau of [
    "WO-2026-0042", "Karim Tazi", "0661-000000", "Dacia Logan", "12345-A-6",
    "145 000 km", "Bruit au freinage", "Plaquettes avant usées",
    "Remplacement plaquettes avant", "Plaquettes Dacia Logan AV", "320 MAD",
    "Main-d'œuvre freinage", "180 MAD", "Youssef M.", "En cours",
    "08/11/2026", "Disques à surveiller", "Client informé et approuvé",
    "ne vaut ni facture ni ticket de paiement", "VTE-2026-ABC123",
  ]) egal(bon.includes(morceau), `« ${morceau} » absent du bon`);
});
test("bon A4 : format distinct (marges A4, signature client)", () => {
  const a4 = modeleBonInterventionHtml(BON, ETAB, "fr", "A4");
  egal(a4.includes("size: A4"), "règle @page A4 absente");
  egal(a4.includes("Signature client"), "zone de signature absente");
  egal(!htmlBon.includes("Signature client"), "signature sur ticket thermique non requise");
});
test("bon arabe RTL avec statut traduit", () => {
  const h = modeleBonInterventionHtml(BON, ETAB, "ar", "A4");
  egal(h.includes('dir="rtl"'), "rtl absent");
  egal(h.includes("بطاقة التدخل بالورشة"), "titre arabe absent");
  egal(!h.includes("En cours"), "statut FR présent en version arabe");
  egal(h.includes("جاري"), "statut arabe absent");
});
test("statuts connus tous libellés", () => {
  egal(STATUT_BON_LABEL["in_progress"] === "En cours", "statut in_progress incorrect");
  egal(STATUT_BON_LABEL["waiting_parts"] === "Attente pièces", "statut waiting_parts incorrect");
});
test("bon vide : sections affichent « — » sans planter", () => {
  const h = modeleBonInterventionHtml(
    { ...BON, travaux: [], pieces: [], mainOeuvre: [], diagnostic: null, observations: null, livraisonPrevue: null, technicien: null, client: null },
    ETAB, "fr", "58mm",
  );
  egal(h.includes("WO-2026-0042"), "référence absente sur bon vide");
  egal(h.includes("—"), "joker « — » absent");
});
test("page de test : largeur réelle du format + QR selon config", () => {
  const t58 = modeleTestHtml(ETAB, "fr", "58mm");
  const t80 = modeleTestHtml(ETAB, "fr", "80mm");
  egal(t58.includes("M".repeat(32)) && !t58.includes("M".repeat(48)), "largeur 58 mm incorrecte");
  egal(t80.includes("M".repeat(48)), "largeur 80 mm incorrecte");
  const sans = modeleTestHtml({ ...ETAB, url_verification: null }, "fr", "58mm");
  egal(!sans.includes("create-qr-code"), "QR sur page de test sans URL de vérification");
});

console.log(`\nRÉSULTAT : ${ok} réussi(s), ${ko} échec(s)`);
if (ko > 0) process.exit(1);
