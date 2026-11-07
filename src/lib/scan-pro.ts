/**
 * AUTO DYALI SCAN PRO — logique pure du moteur de scan.
 *
 * Ce module ne dépend ni de React ni du navigateur : il est exécuté
 * côté client ET testé par `scripts/test-scan-pro.mjs` (node).
 *
 * Responsabilités :
 * - détection honnête de format (estimation, jamais une affirmation) ;
 * - contrôles de clé (EAN-13, EAN-8, UPC-A) ;
 * - tampon de douchette HID (burst clavier, validation Entrée, anti-explosion) ;
 * - anti-double-lecture (fenêtre glissante) ;
 * - résolution d'un code → produit (code associé → code-barres → SKU) ;
 * - détection d'un contenu QR qui N'EST PAS une identification produit
 *   (URL / texte libre) — jamais traité comme un code produit fiable ;
 * - génération de chiffres de contrôle pour l'administration des codes.
 */

/* ---------------------------------------------------------------------
 * Formats
 * ------------------------------------------------------------------- */

export type SourceScan = "douchette" | "camera" | "saisie";

export type FormatScan =
  | "ean13"
  | "ean8"
  | "upca"
  | "upce"
  | "code128"
  | "code39"
  | "qr"
  | "datamatrix"
  | "inconnu";

/** Libellés affichés (matrice de compatibilité et UI). */
export const FORMAT_LABEL: Record<FormatScan, string> = {
  ean13: "EAN-13",
  ean8: "EAN-8",
  upca: "UPC-A",
  upce: "UPC-E",
  code128: "Code 128",
  code39: "Code 39",
  qr: "QR Code",
  datamatrix: "DataMatrix",
  inconnu: "Format non identifié",
};

/**
 * Formats décodés par la CAMÉRA (bibliothèque html5-qrcode installée).
 * Lister un format ici = bibliothèque capable de le DÉCODER ; la lecture
 * réelle sur votre matériel reste à valider (voir matrice de compatibilité).
 */
export const FORMATS_CAMERA: FormatScan[] = [
  "ean13",
  "ean8",
  "upca",
  "upce",
  "code128",
  "code39",
  "qr",
  "datamatrix",
];

/**
 * Formats transmissibles par une DOUCHETTE (HID clavier) : la douchette
 * envoie le contenu TEXTUEL du symbole — le décodage est fait par le
 * matériel, le navigateur ne reçoit que la chaîne.
 */
export const FORMATS_DOUCHETTE: FormatScan[] = [
  "ean13",
  "ean8",
  "upca",
  "upce",
  "code128",
  "code39",
  "qr", // douchettes 2D : envoient le contenu du QR comme texte
  "datamatrix",
];

/* ---------------------------------------------------------------------
 * Normalisation & détection (honnête : une estimation, pas une preuve)
 * ------------------------------------------------------------------- */

/** Nettoie un code sans jamais vider un contenu utile (QR non alphanumérique). */
export function normaliserCode(brut: string): string {
  const propre = brut.replace(/[^\dA-Za-z]/g, "");
  return propre || brut.trim();
}

/** Un contenu QR/URL n'est PAS une identification produit fiable. */
export function estContenuUrl(texte: string): boolean {
  const t = texte.trim().toLowerCase();
  return (
    t.includes("://") ||
    t.startsWith("www.") ||
    t.startsWith("http") ||
    (t.includes("@") && t.includes("."))
  );
}

/** Estimation de format d'après la forme du code (jamais une affirmation). */
export function detecterFormat(code: string): FormatScan {
  const c = code.trim();
  if (!c) return "inconnu";
  // 13 chiffres : EAN-13 (le contrôle de clé est vérifié à part, validerEan13).
  if (/^\d{13}$/.test(c)) return "ean13";
  if (/^\d{8}$/.test(c)) return "ean8";
  if (/^\d{12}$/.test(c)) return "upca";
  if (/^\d{6}$/.test(c)) return "upce";
  if (/^[0-9]+$/.test(c)) return "inconnu";
  if (/^[A-Z0-9\-. $/+%]{4,}$/i.test(c)) return "code128";
  return "inconnu";
}

/* ---------------------------------------------------------------------
 * Contrôles de clé (modulo 10, pondération 3/1 alternée)
 * ------------------------------------------------------------------- */

function chiffreControleBase(donnees: string): number {
  let somme = 0;
  for (let i = 0; i < donnees.length; i++) {
    const poids = donnees.length % 2 === 0 ? (i % 2 === 0 ? 1 : 3) : i % 2 === 0 ? 3 : 1;
    somme += Number(donnees[i]) * poids;
  }
  return (10 - (somme % 10)) % 10;
}

/** EAN-13 : 12 chiffres + contrôle. */
export function chiffreControleEan13(donnees12: string): number {
  return chiffreControleBase(donnees12);
}

/** EAN-8 : 7 chiffres + contrôle. */
export function chiffreControleEan8(donnees7: string): number {
  return chiffreControleBase(donnees7);
}

/** UPC-A : 11 chiffres + contrôle. */
export function chiffreControleUpcA(donnees11: string): number {
  return chiffreControleBase(donnees11);
}

export function validerEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return chiffreControleEan13(code.slice(0, 12)) === Number(code[12]);
}

export function validerEan8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  return chiffreControleEan8(code.slice(0, 7)) === Number(code[7]);
}

export function validerUpcA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  return chiffreControleUpcA(code.slice(0, 11)) === Number(code[11]);
}

/* ---------------------------------------------------------------------
 * Tampon douchette HID (le lecteur écrit comme un clavier)
 * ------------------------------------------------------------------- */

export type EtatTampon = { tampon: string; dernier: number };

export const GAP_MAX_MS = 90; // un burst HID est bien plus rapide qu'une frappe humaine
export const LONGUEUR_MIN = 4;
export const LONGUEUR_MAX = 64;

export function creerTampon(): EtatTampon {
  return { tampon: "", dernier: 0 };
}

export type ResultatFrappe = {
  /** Ce qu'il faut afficher dans la case (burst en cours ou code final). */
  affichage: string;
  /** Un code complet validé (Entrée) ou auto-completé (EAN-13 à 13 chiffres). */
  code?: string;
  /** Le tampon a expiré (pause trop longue entre deux touches). */
  expire?: boolean;
};

/**
 * Alimente le tampon avec une frappe.
 * - pause > GAP_MAX_MS ⇒ nouveau burst (la frappe humaine est lente) ;
 * - Entrée avec >= LONGUEUR_MIN caractères ⇒ validation ;
 * - 13 chiffres d'affilée ⇒ EAN-13 auto-completé (douchette sans terminateur) ;
 * - ignore les raccourcis clavier (Meta/Ctrl/Alt).
 */
export function frappeTampon(
  etat: EtatTampon,
  touche: string,
  maintenant: number,
): ResultatFrappe {
  if (touche === "Enter") {
    if (etat.tampon.length >= LONGUEUR_MIN) {
      const code = etat.tampon;
      etat.tampon = "";
      etat.dernier = 0;
      return { affichage: code, code };
    }
    etat.tampon = "";
    return { affichage: "" };
  }

  if (etat.dernier && maintenant - etat.dernier > GAP_MAX_MS) {
    // Pause : nouveau burst. L'ancien tampon est perdu — c'est une frappe
    // humaine trop lente, gérée par la saisie manuelle du champ.
    const expire = etat.tampon.length > 0;
    etat.tampon = "";
    etat.dernier = 0;
    if (expire) return { affichage: "", expire: true };
  }

  if (touche.length !== 1) return { affichage: etat.tampon };

  etat.tampon += touche;
  etat.dernier = maintenant;
  if (etat.tampon.length > LONGUEUR_MAX) etat.tampon = etat.tampon.slice(-LONGUEUR_MAX);

  // Auto-completage EAN-13 (13 chiffres d'affilée, sans attendre Entrée).
  if (/^\d{13}$/.test(etat.tampon)) {
    const code = etat.tampon;
    etat.tampon = "";
    etat.dernier = 0;
    return { affichage: code, code };
  }

  return { affichage: etat.tampon };
}

/* ---------------------------------------------------------------------
 * Anti-double-lecture (fenêtre glissante)
 * ------------------------------------------------------------------- */

/**
 * Une même lecture physique peut émettre deux événements (cadence caméra,
 * rebond mécanique). On rejette le même code dans une fenêtre courte.
 * Deux scans VOLONTAIFS successifs du même produit restent acceptés s'ils
 * sont séparés de plus que la fenêtre (le POS incrémente alors la quantité).
 */
export function creerAntiDoublon(fenetreMs = 450) {
  let dernier: { code: string; at: number } | null = null;
  return {
    accepter(code: string, maintenant: number): boolean {
      if (dernier && dernier.code === code && maintenant - dernier.at < fenetreMs) {
        return false;
      }
      dernier = { code, at: maintenant };
      return true;
    },
    reinitialiser() {
      dernier = null;
    },
  };
}

/* ---------------------------------------------------------------------
 * Résolution code → produit
 * ------------------------------------------------------------------- */

export type ProduitRef = {
  id: string;
  sku: string;
  barcode?: string | null;
  nom?: string;
  name?: string;
};

export type CodeAssocie = { code: string; product_id: string };

export type Resolution = {
  produit: ProduitRef;
  origine: "code associé" | "code-barres produit" | "référence SKU";
};

/**
 * Ordre de résolution : code enregistré (table product_barcodes) →
 * code-barres du produit → référence SKU. Aucune autre heuristique :
 * un code non enregistré n'est JAMAIS deviné.
 */
export function resoudreCode(
  code: string,
  produits: ProduitRef[],
  codesAssocies: CodeAssocie[],
): Resolution | null {
  // Comparaison en deux formes : tel que lu (les SKU contiennent des
  // tirets) et entièrement normalisé (une douchette peut striper).
  const brut = code.trim().toLowerCase();
  const propre = brut.replace(/[^a-z0-9]/g, "");
  const correspond = (valeur: string | null | undefined): boolean => {
    const v = (valeur ?? "").trim().toLowerCase();
    if (!v || !propre) return false;
    return v === brut || v.replace(/[^a-z0-9]/g, "") === propre;
  };

  const associe = codesAssocies.find((x) => correspond(x.code));
  if (associe) {
    const produit = produits.find((p) => p.id === associe.product_id);
    if (produit) return { produit, origine: "code associé" };
  }

  const parBarcode = produits.find((p) => correspond(p.barcode));
  if (parBarcode) return { produit: parBarcode, origine: "code-barres produit" };

  const parSku = produits.find((p) => correspond(p.sku));
  if (parSku) return { produit: parSku, origine: "référence SKU" };

  return null;
}

/* ---------------------------------------------------------------------
 * Génération (administration des codes)
 * ------------------------------------------------------------------- */

export type GenerationEan13 = {
  code: string;
  /** false = les 12 chiffres fournis étaient invalides. */
  valide: boolean;
  /**
   * true = aucun préfixe GS1 réel n'a été fourni : le code est un code de
   * TEST, à ne pas utiliser commercialement (règle d'honnêteté du projet).
   */
  test: boolean;
};

/**
 * Génère un EAN-13 complet.
 * - `prefixe` : préfixe GS1 attribué à l'entreprise (requis pour un code
 *   commercial réel) ;
 * - sans préfixe, on génère un code de TEST explicitement marqué.
 */
export function genererEan13(prefixe: string, numero: string): GenerationEan13 {
  const chiffres = `${prefixe}${numero}`.replace(/\D/g, "");
  if (chiffres.length > 12) return { code: "", valide: false, test: !prefixe.trim() };
  const base = chiffres.padStart(12, "0");
  const ctrl = chiffreControleEan13(base);
  const code = `${base}${ctrl}`;
  return { code, valide: true, test: !prefixe.trim() };
}

/** QR : contenu = le code lui-même (jamais une URL devinée). */
export function contenuQr(code: string): string {
  return normaliserCode(code);
}
