// AUTO DYALI SCAN PRO — tests du moteur (logique pure).
// Exécution : . ~/.local/node-env.sh && node scripts/test-scan-pro.mjs
// Aucun navigateur requis : le cœur du scan est testé ici, en vrai.

import {
  normaliserCode,
  estContenuUrl,
  detecterFormat,
  chiffreControleEan13,
  chiffreControleEan8,
  chiffreControleUpcA,
  validerEan13,
  validerEan8,
  validerUpcA,
  creerTampon,
  frappeTampon,
  creerAntiDoublon,
  resoudreCode,
  genererEan13,
  GAP_MAX_MS,
} from "../src/lib/scan-pro.ts";

let ok = 0;
let ko = 0;

function test(nom, fn) {
  try {
    fn();
    ok++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    ko++;
    console.error(`  ✗ ${nom}\n    ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log("\nSCAN PRO — contrôles de clé (EAN/UPC)");
test("EAN-13 : le chiffre calculé valide le code complet", () => {
  const base = "345678901234"; // 12 chiffres arbitraires
  const ctrl = chiffreControleEan13(base);
  assert(validerEan13(base + ctrl), "le code devrait être valide");
});
test("EAN-13 : un mauvais chiffre de contrôle est rejeté", () => {
  const base = "345678901234";
  const ctrl = chiffreControleEan13(base);
  const faux = String((ctrl + 1) % 10);
  assert(!validerEan13(base + faux), "le code faux devrait être rejeté");
});
test("EAN-13 : longueur != 13 rejetée", () => {
  assert(!validerEan13("123"), "court devrait être rejeté");
});
test("EAN-8 : cycle complet", () => {
  const base = "1234567";
  const code = base + chiffreControleEan8(base);
  assert(validerEan8(code), "EAN-8 devrait passer");
  assert(!validerEan8(base + "0") || chiffreControleEan8(base) === 0, "cas limite");
});
test("UPC-A : cycle complet", () => {
  const base = "01234567890";
  const code = base + chiffreControleUpcA(base);
  assert(validerUpcA(code), "UPC-A devrait passer");
});

console.log("\nSCAN PRO — détection de format (estimation)");
test("13 chiffres → ean13 ; 8 → ean8 ; 12 → upca", () => {
  assert(detecterFormat("9990000000017") === "ean13", "13 chiffres");
  assert(detecterFormat("12345678") === "ean8", "8 chiffres");
  assert(detecterFormat("012345678905") === "upca", "12 chiffres");
});
test("alphanumérique long → code128 ; vide → inconnu", () => {
  assert(detecterFormat("ABC-1234") === "code128", "code alphanumérique");
  assert(detecterFormat("") === "inconnu", "vide");
});

console.log("\nSCAN PRO — tampon douchette HID");
test("burst de 13 chiffres rapide → EAN-13 auto-completé", () => {
  const t = creerTampon();
  let code;
  for (let i = 0; i < 13; i++) {
    const r = frappeTampon(t, "9", 1000 + i * 5);
    if (r.code) code = r.code;
  }
  assert(code === "9".repeat(13), `code attendu, obtenu : ${code}`);
});
test("Entrée valide un code >= 4 caractères", () => {
  const t = creerTampon();
  for (const c of "AB12") frappeTampon(t, c, 2000);
  const r = frappeTampon(t, "Enter", 2010);
  assert(r.code === "AB12", `attendu AB12, obtenu ${r.code}`);
});
test("Entrée sans code (tampon vide) ne renvoie rien", () => {
  const t = creerTampon();
  const r = frappeTampon(t, "Enter", 3000);
  assert(!r.code, "aucun code attendu");
});
test("pause trop longue (> GAP_MAX_MS) expire le burst", () => {
  const t = creerTampon();
  frappeTampon(t, "1", 4000);
  frappeTampon(t, "2", 4010);
  const r = frappeTampon(t, "3", 4010 + GAP_MAX_MS + 50);
  assert(r.expire === true, "le burst devait expirer");
  assert(r.affichage === "", "le tampon devait être vidé");
});
test("deux scans du même produit séparés > fenêtre sont tous acceptés", () => {
  // Cas POS : on scanne 3 fois le même produit pour vendre 3 unités.
  const anti = creerAntiDoublon();
  assert(anti.accepter("9990000000017", 10000), "1er accepté");
  assert(!anti.accepter("9990000000017", 10100), "double lecture rejetée");
  assert(anti.accepter("9990000000017", 10600), "2e scan volontaire accepté");
  assert(anti.accepter("9990000000024", 10610), "autre code accepté");
});

console.log("\nSCAN PRO — résolution code → produit");
const produits = [
  { id: "p1", sku: "FIL-MAH-OL01", barcode: "9990000000017", nom: "Filtre Mahle" },
  { id: "p2", sku: "LUB-TOT-10W40", barcode: "9990000000062", nom: "Huile Total" },
];
const associes = [{ code: "3456789012345", product_id: "p2" }];

test("code associé (product_barcodes) prioritaire", () => {
  const r = resoudreCode("3456789012345", produits, associes);
  assert(r && r.produit.id === "p2" && r.origine === "code associé", "p2 via code associé");
});
test("code-barres du produit ensuite", () => {
  const r = resoudreCode("9990000000017", produits, associes);
  assert(r && r.produit.id === "p1" && r.origine === "code-barres produit", "p1 via barcode");
});
test("référence SKU en dernier recours", () => {
  const r = resoudreCode("lub-tot-10w40", produits, associes);
  assert(r && r.produit.id === "p2" && r.origine === "référence SKU", "p2 via SKU");
});
test("code inconnu → null (aucune création automatique)", () => {
  assert(resoudreCode("0000000000000", produits, associes) === null, "inconnu = null");
});

console.log("\nSCAN PRO — honnêteté des contenus QR");
test("URL détectée comme non-identification", () => {
  assert(estContenuUrl("https://auto-dyali.ma/p/123"), "URL https");
  assert(estContenuUrl("www.exemple.ma"), "www");
  assert(!estContenuUrl("9990000000017"), "EAN n'est pas une URL");
  assert(!estContenuUrl("FIL-MAH-OL01"), "SKU n'est pas une URL");
});
test("normaliserCode ne vide jamais un contenu utile", () => {
  assert(normaliserCode("https://a.ma/x?y=1") !== "", "URL conservée");
  assert(normaliserCode("  9990000000017  ") === "9990000000017", "EAN nettoyé");
});

console.log("\nSCAN PRO — génération (administration des codes)");
test("EAN-13 généré avec préfixe = chiffre de contrôle valide", () => {
  const g = genererEan13("345678", "901234");
  assert(g.valide, "devrait être valide");
  assert(validerEan13(g.code), "le code généré doit passer son propre contrôle");
  assert(g.test === false, "avec préfixe, ce n'est pas un test");
});
test("sans préfixe GS1 → code marqué TEST (jamais présenté comme réel)", () => {
  const g = genererEan13("", "123");
  assert(g.test === true, "doit être marqué test");
  assert(validerEan13(g.code), "même le code de test doit être structurellement valide");
});
test("préfixe trop long → refus", () => {
  const g = genererEan13("1234567890123", "9");
  assert(!g.valide, "doit refuser");
});

console.log(`\nRÉSULTAT : ${ok} réussi(s), ${ko} échec(s)\n`);
process.exit(ko === 0 ? 0 : 1);
