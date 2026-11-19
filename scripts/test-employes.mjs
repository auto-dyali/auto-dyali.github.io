/**
 * AUTO DYALI — Tests unitaires : gestion des employés (Super Admin)
 * Validations pures (pas d'accès Supabase requis).
 */
import assert from "node:assert";

/**
 * Valide un code employé : 3 à 10 caractères, alphanumérique avec tirets autorisés.
 */
function validerCodeEmploye(code) {
  if (!code || typeof code !== "string") return false;
  const trimmed = code.trim();
  if (trimmed.length < 3 || trimmed.length > 10) return false;
  return /^[A-Z0-9-]+$/.test(trimmed);
}

/**
 * Valide un nom complet : 2 à 50 caractères, lettres et espaces autorisés.
 */
function validerNomComplet(nom) {
  if (!nom || typeof nom !== "string") return false;
  const trimmed = nom.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  return /^[A-Za-zÀ-ÿ'-]+(\s[A-Za-zÀ-ÿ'-]+)*$/.test(trimmed);
}

/**
 * Valide un téléphone marocain : optionnel, format +212 X XX XX XX XX ou 0X XX XX XX XX.
 */
function validerTelephone(tel) {
  if (!tel || tel.trim() === "") return true; // téléphone optionnel
  const cleaned = tel.replace(/\s/g, "");
  return /^(\+212|0)[5-7][0-9]{8}$/.test(cleaned);
}

/**
 * Valide un intitulé de poste : optionnel, 2 à 30 caractères.
 */
function validerIntitulePoste(intitule) {
  if (!intitule || intitule.trim() === "") return true; // optionnel
  const trimmed = intitule.trim();
  return trimmed.length >= 2 && trimmed.length <= 30;
}

/**
 * Construit un employé à partir des données du formulaire.
 * Retourne { ok: true, employe } ou { ok: false, erreurs: [...] }.
 */
function construireEmploye(donnees) {
  const erreurs = [];

  if (!validerNomComplet(donnees.full_name)) {
    erreurs.push("Le nom complet est obligatoire (2 à 50 caractères).");
  }

  if (donnees.code && !validerCodeEmploye(donnees.code)) {
    erreurs.push("Le code employé doit contenir 3 à 10 caractères (majuscules, chiffres, tirets).");
  }

  if (donnees.phone && !validerTelephone(donnees.phone)) {
    erreurs.push("Le téléphone est invalide (format marocain attendu).");
  }

  if (donnees.job_title && !validerIntitulePoste(donnees.job_title)) {
    erreurs.push("L'intitulé de poste doit contenir 2 à 30 caractères.");
  }

  if (erreurs.length > 0) {
    return { ok: false, erreurs };
  }

  return {
    ok: true,
    employe: {
      full_name: donnees.full_name.trim().replace(/\s+/g, " "),
      job_title: donnees.job_title ? donnees.job_title.trim() : null,
      code: donnees.code ? donnees.code.trim() : null,
      phone: donnees.phone ? donnees.phone.trim() : null,
      establishment_id: donnees.establishment_id || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let tests = 0;
let echecs = 0;

function test(nom, fn) {
  tests++;
  try {
    fn();
    console.log(`✔ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`✘ ${nom}: ${e.message}`);
  }
}

// 1. Nom complet valide
test("Nom complet valide accepté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont" });
  if (!r.ok) throw new Error("devrait être accepté");
  if (r.employe.full_name !== "Jean Dupont") throw new Error("nom non conservé");
});

// 2. Nom complet trop court
test("Nom complet trop court rejeté", () => {
  const r = construireEmploye({ full_name: "J" });
  if (r.ok) throw new Error("devrait être rejeté");
  if (!r.erreurs.some((e) => e.includes("nom complet"))) throw new Error("message attendu");
});

// 3. Nom complet vide rejeté
test("Nom complet vide rejeté", () => {
  const r = construireEmploye({ full_name: "" });
  if (r.ok) throw new Error("devrait être rejeté");
});

// 4. Code employé valide
test("Code employé valide accepté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont", code: "EMP-001" });
  if (!r.ok) throw new Error("devrait être accepté");
  if (r.employe.code !== "EMP-001") throw new Error("code non conservé");
});

// 5. Code employé avec minuscules rejeté
test("Code employé minuscules rejeté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont", code: "emp-001" });
  if (r.ok) throw new Error("devrait être rejeté");
});

// 6. Code employé trop long rejeté
test("Code employé trop long rejeté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont", code: "EMP-00123456789" });
  if (r.ok) throw new Error("devrait être rejeté");
});

// 7. Téléphone marocain valide (+212)
test("Téléphone +212 valide accepté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont", phone: "+212 6 00 00 00 00" });
  if (!r.ok) throw new Error("devrait être accepté");
  if (r.employe.phone !== "+212 6 00 00 00 00") throw new Error("téléphone non conservé");
});

// 8. Téléphone marocain valide (06)
test("Téléphone 06 valide accepté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont", phone: "06 00 00 00 00" });
  if (!r.ok) throw new Error("devrait être accepté");
});

// 9. Téléphone invalide rejeté
test("Téléphone invalide rejeté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont", phone: "01 23 45 67 89" });
  if (r.ok) throw new Error("devrait être rejeté");
});

// 10. Téléphone optionnel
test("Téléphone optionnel accepté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont" });
  if (!r.ok) throw new Error("devrait être accepté sans téléphone");
  if (r.employe.phone !== null) throw new Error("téléphone devrait être null");
});

// 11. Intitulé de poste valide
test("Intitulé de poste valide accepté", () => {
  const r = construireEmploye({ full_name: "Jean Dupont", job_title: "Mécanicien senior" });
  if (!r.ok) throw new Error("devrait être accepté");
  if (r.employe.job_title !== "Mécanicien senior") throw new Error("poste non conservé");
});

// 12. Employé complet
test("Employé complet avec tous les champs", () => {
  const r = construireEmploye({
    full_name: "Fatima Zahra",
    code: "EMP-002",
    phone: "07 12 34 56 78",
    job_title: "Responsable stock",
    establishment_id: "uuid-test-123",
  });
  if (!r.ok) throw new Error("devrait être accepté");
  if (r.employe.establishment_id !== "uuid-test-123") throw new Error("établissement non conservé");
});

// 13. Plusieurs erreurs en même temps
test("Plusieurs erreurs détectées", () => {
  const r = construireEmploye({ full_name: "J", code: "emp", phone: "01 23 45 67 89" });
  if (r.ok) throw new Error("devrait être rejeté");
  if (r.erreurs.length < 3) throw new Error(`au moins 3 erreurs attendues, trouvé ${r.erreurs.length}`);
});

// 14. Espaces autour du nom supprimés
test("Espaces autour du nom supprimés", () => {
  const r = construireEmploye({ full_name: "  Jean  Dupont  " });
  if (!r.ok) throw new Error("devrait être accepté");
  if (r.employe.full_name !== "Jean Dupont") throw new Error("espaces non supprimés");
});

// 15. Code avec espaces supprimés
test("Espaces autour du code supprimés", () => {
  const r = construireEmploye({ full_name: "Jean Dupont", code: "  EMP-001  " });
  if (!r.ok) throw new Error("devrait être accepté");
  if (r.employe.code !== "EMP-001") throw new Error("espaces du code non supprimés");
});

console.log(`\n${tests === echecs ? "✔" : "✘"} ${tests} tests, ${echecs} échec(s)`);
process.exit(echecs > 0 ? 1 : 0);
