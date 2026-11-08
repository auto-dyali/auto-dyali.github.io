/**
 * AUTO DYALI PRINT PRO — moteur d'impression (logique pure).
 *
 * Ce module ne dépend ni de React ni du navigateur : il est exécuté
 * côté client ET testé par `scripts/test-print-pro.mjs` (node).
 *
 * Responsabilités :
 * - modèles de documents : ticket de paiement, bon d'intervention (FR / AR RTL) ;
 * - génération ESC/POS (octets bruts) pour imprimantes thermiques 58 / 80 mm ;
 * - largeurs honnêtes : 32 caractères (58 mm), 48 caractères (80 mm) ;
 * - QR code ESC/POS natif, UNIQUEMENT si l'établissement configure une URL
 *   de vérification réelle (sinon aucun QR n'est généré) ;
 * - limites honnêtes du navigateur (voir imprimanteHtmlClient dans le
 *   module React) : une imprimante USB / Bluetooth n'est PAS accessible
 *   depuis tous les navigateurs — la voie générale reste l'impression
 *   navigateur (dialogue système) et le PDF.
 */

/* ---------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------- */

export type FormatPapier = "58mm" | "80mm" | "A4";

export type ConnexionImprimante = "navigateur" | "usb" | "reseau" | "bluetooth";

export type TypeDocument =
  | "ticket_vente"
  | "bon_intervention"
  | "devis"
  | "facture"
  | "test";

export const FORMAT_LABEL: Record<FormatPapier, string> = {
  "58mm": "Thermique 58 mm",
  "80mm": "Thermique 80 mm",
  A4: "A4 / PDF",
};

export const CONNEXION_LABEL: Record<ConnexionImprimante, string> = {
  navigateur: "Navigateur (dialogue système / PDF)",
  usb: "USB (WebUSB — Chrome/Edge desktop uniquement)",
  reseau: "Réseau local (via pilote du poste — pas de socket navigateur)",
  bluetooth: "Bluetooth (Web Bluetooth — Chrome/Edge, appareils compatibles)",
};

export const DOCUMENT_LABEL: Record<TypeDocument, string> = {
  ticket_vente: "Ticket de paiement",
  bon_intervention: "Bon d'intervention",
  devis: "Devis",
  facture: "Facture",
  test: "Page de test",
};

export type Etablissement = {
  /** Identifiant Supabase (optionnel — utile pour la journalisation). */
  id?: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  /** URL publique de vérification d'un document (ex. https://…/verif?ref=).
   *  Absente ou vide → AUCUN QR n'est imprimé (honnêteté : pas de QR
   *  décoratif qui ne renvoie à rien de vérifiable). */
  url_verification?: string | null;
};

export type LigneTicket = {
  nom: string;
  reference?: string | null;
  quantite: number;
  prix: number;
  remisePct?: number;
  tvaPct?: number;
};

export type ReglementTicket = { methode: string; montant: number };

export type DonneesTicket = {
  reference: string;
  date: string;
  caissier: string | null;
  client: string | null;
  vehicule: string | null;
  /** Détail du véhicule immatriculé, si connu. */
  vehiculeDetails?: string | null;
  lignes: LigneTicket[];
  remiseTicket: number;
  totalTTC: number;
  reglements: ReglementTicket[];
  paye: number;
  reste: number;
  monnaie: number;
  /** Référence de transaction (id de vente tronqué) si disponible. */
  referenceTransaction?: string | null;
  /** Réimpression : conserver le numéro de vente initial et l'annoncer. */
  reimpression?: number | null;
};

export type LigneBon = { label: string; statut?: string | null; prix?: number | null };

export type DonneesBon = {
  reference: string;
  dateOuverture: string;
  client: string | null;
  telephoneClient?: string | null;
  vehicule: { marque: string | null; modele: string | null; plaque: string | null; kilometrage?: number | null };
  motif: string | null;
  diagnostic: string | null;
  travaux: LigneBon[];
  pieces: LigneBon[];
  mainOeuvre: LigneBon[];
  technicien: string | null;
  statut: string;
  livraisonPrevue: string | null;
  observations: string | null;
  clientApprouve: boolean;
  /** Éléments déjà facturés via le POS, si connus. */
  ventesLiees?: string[];
};

export const STATUT_BON_LABEL: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  waiting_parts: "Attente pièces",
  done: "Terminé",
  delivered: "Livré",
  cancelled: "Annulé",
};

export const STATUT_BON_LABEL_AR: Record<string, string> = {
  pending: "في انتظار",
  in_progress: "جاري",
  waiting_parts: "انتظار القطع",
  done: "منتهي",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

/** Libellé de statut selon la langue (fr / ar). */
export function libelleStatut(statut: string, langue: "fr" | "ar"): string {
  if (langue === "ar") return STATUT_BON_LABEL_AR[statut] ?? statut;
  return STATUT_BON_LABEL[statut] ?? statut;
}

/* ---------------------------------------------------------------------
 * Formatage monétaire (cohérent avec le reste de l'application)
 * ------------------------------------------------------------------- */

export function mad(value: number): string {
  return `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

/* ---------------------------------------------------------------------
 * Largeurs et habillage de lignes (ESC/POS)
 * ------------------------------------------------------------------- */

/** Colonnes utiles par format thermique. A4 ne passe PAS en ESC/POS. */
export function colonnesEscpos(format: FormatPapier): number {
  if (format === "58mm") return 32;
  if (format === "80mm") return 48;
  return 0; // A4 : impression navigateur uniquement
}

/** Découpe un texte en lignes de `largeur` caractères maximum. */
export function habillerTexte(texte: string, largeur: number): string[] {
  if (largeur <= 0) return [texte];
  const mots = texte.split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [""];
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length <= largeur) {
      courante = essai;
    } else {
      if (courante) lignes.push(courante);
      if (mot.length > largeur) {
        // Mot plus long que la ligne : découpe dure honnête.
        for (let i = 0; i < mot.length; i += largeur) lignes.push(mot.slice(i, i + largeur));
        courante = "";
      } else {
        courante = mot;
      }
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/** Deux colonnes « libellé … montant » sur `largeur` caractères.
 *  Le montant (droite) est toujours conservé intact : on tronque
 *  éventuellement le libellé, jamais le chiffre. */
export function ligneDeuxColonnes(gauche: string, droite: string, largeur: number): string {
  if (largeur <= 0) return `${gauche} ${droite}`;
  const d = droite.length > largeur ? droite.slice(0, largeur) : droite;
  const gMax = Math.max(0, largeur - d.length - 1);
  const g = gauche.length > gMax ? gauche.slice(0, gMax) : gauche.padEnd(gMax, " ");
  return `${g} ${d}`.slice(0, largeur);
}

export function ligneSeparateur(largeur: number): string {
  return "-".repeat(largeur);
}

/* ---------------------------------------------------------------------
 * Génération ESC/POS (octets bruts)
 * ------------------------------------------------------------------- */

export type BlocEscpos = {
  texte: string;
  aligne?: "gauche" | "centre" | "droite";
  gras?: boolean;
  taille?: "normal" | "grand" | "grand2";
  separateurAvant?: boolean;
  separateurApres?: boolean;
};

const ESC = 0x1b;
const GS = 0x1d;

/** Texte → lignes ESC/POS prêtes (pur, facile à tester).
 *  `opts.couper` (défaut true) : ajoute l'avance et la coupe finale.
 *  Passer false pour concaténer d'autres commandes (QR…) avant la coupe. */
export function lignesEscpos(blocs: BlocEscpos[], format: FormatPapier, opts?: { couper?: boolean }): Uint8Array {
  const largeur = colonnesEscpos(format);
  const couper = opts?.couper !== false;
  const octets: number[] = [];

  const push = (...b: number[]) => octets.push(...b);
  const texte = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      push(c < 128 ? c : 0x3f); // hors ASCII → « ? » (honnête : l'ESC/POS de base n'a pas l'UTF-8 garanti)
    }
  };

  // Init imprimante
  push(ESC, 0x40);

  for (const bloc of blocs) {
    const lignes = habillerTexte(bloc.texte, Math.max(1, largeur - (bloc.taille === "grand2" ? 0 : 0)));
    if (bloc.separateurAvant) {
      for (const l of habillerTexte("-".repeat(largeur), largeur)) texte(l + "\n");
    }
    const gras = bloc.gras ? 1 : 0;
    const taille = bloc.taille === "grand2" ? 0x11 : bloc.taille === "grand" ? 0x10 : 0x00;

    for (const ligne of lignes) {
      let l = ligne;
      if (bloc.taille === "grand2") {
        // Double largeur → une ligne de `largeur` couvre la moitié de caractères.
        const moitie = Math.max(1, Math.floor(largeur / 2));
        l = habillerTexte(ligne, moitie)[0] ?? ligne;
      }
      push(ESC, 0x61, bloc.aligne === "centre" ? 1 : bloc.aligne === "droite" ? 2 : 0);
      push(ESC, 0x45, gras);
      push(GS, 0x21, taille);
      texte(l + "\n");
    }
    if (bloc.separateurApres) {
      for (const l of habillerTexte("-".repeat(largeur), largeur)) texte(l + "\n");
    }
  }

  // Avance + coupe (sauf si `couper: false` — concaténation QR ensuite)
  if (couper) push(0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00);

  return new Uint8Array(octets);
}

/** Avance de 3 lignes + coupe partielle — utilisé après un QR. */
export function coupeEscpos(): Uint8Array {
  return new Uint8Array([0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00]);
}

/** QR code ESC/POS natif (Modèle 2, correction M). Aucune dépendance :
 *  l'imprimante dessine le QR elle-même. */
export function qrEscpos(donnees: string): Uint8Array {
  const octets: number[] = [];
  const push = (...b: number[]) => octets.push(...b);
  const data = new TextEncoder ? Array.from(new TextEncoder().encode(donnees)) : donnees.split("").map((c) => c.charCodeAt(0) & 0x7f);
  const n = data.length;

  // GS ( k pL pH cn fn … — fonction 165 : modèle 2
  push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0xa5, 0x32, 0x00);
  // Taille du module (3 → ≈ 1 mm/point sur la plupart des modèles)
  push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x03);
  // Correction d'erreur M
  push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
  // Stockage des données
  push(GS, 0x28, 0x6b, (n + 3) & 0xff, ((n + 3) >> 8) & 0xff, 0x31, 0x50, 0x30, ...data);
  // Impression
  push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

  return new Uint8Array(octets);
}

/** Payload ESC/POS complet d'un ticket : en-tête, lignes, totaux, QR éventuel, coupe. */
export function ticketEscpos(t: DonneesTicket, etab: Etablissement, format: FormatPapier): Uint8Array {
  const largeur = colonnesEscpos(format);
  const blocs: BlocEscpos[] = [
    { texte: etab.nom, aligne: "centre", gras: true, taille: "grand" },
    ...(etab.adresse ? [{ texte: [etab.adresse, etab.ville].filter(Boolean).join(", ") }] : []),
    ...(etab.telephone ? [{ texte: `Tél : ${etab.telephone}` }] : []),
    { texte: `TICKET ${t.reference}`, aligne: "centre", gras: true, separateurAvant: true },
    { texte: t.date },
    ...(t.caissier ? [{ texte: `Caissier : ${t.caissier}` }] : []),
    ...(t.reimpression ? [{ texte: `RÉIMPRESSION n°${t.reimpression} — vente ${t.reference}` }] : []),
    { texte: `Client : ${t.client ?? "Comptoir"}` },
    ...(t.vehicule ? [{ texte: `Véhicule : ${t.vehicule}` }] : []),
    { texte: "Articles", gras: true, separateurApres: true },
  ];

  for (const l of t.lignes) {
    blocs.push({ texte: `${l.nom}${l.reference ? ` [${l.reference}]` : ""}` });
    const qte = `x${l.quantite}`;
    const pu = mad(l.prix);
    blocs.push({ texte: ligneDeuxColonnes(`${qte} @ ${pu}`, mad(l.quantite * l.prix * (1 - (l.remisePct ?? 0) / 100)), largeur) });
    if (l.remisePct && l.remisePct > 0) blocs.push({ texte: `  remise ${l.remisePct}%` });
  }

  blocs.push({ texte: ligneSeparateur(largeur), separateurApres: true });
  blocs.push({ texte: ligneDeuxColonnes("Total TTC", mad(t.totalTTC), largeur), gras: true, taille: "grand" });
  for (const r of traduireReglements(t.reglements, "fr")) {
    blocs.push({ texte: ligneDeuxColonnes(`Payé (${r.methode})`, mad(r.montant), largeur) });
  }
  if (t.monnaie > 0) blocs.push({ texte: ligneDeuxColonnes("Monnaie rendue", mad(t.monnaie), largeur) });
  if (t.reste > 0) blocs.push({ texte: ligneDeuxColonnes("RESTE À PAYER", mad(t.reste), largeur), gras: true });
  if (t.referenceTransaction) blocs.push({ texte: `Transaction : ${t.referenceTransaction}` });
  blocs.push({ texte: "Merci de votre confiance !", aligne: "centre", separateurAvant: true });

  // Texte sans coupe, puis QR natif SI (et seulement si) l'établissement
  // a configuré une URL de vérification réelle, puis coupe.
  const texte = lignesEscpos(blocs, format, { couper: false });
  if (etab.url_verification) {
    const url = `${etab.url_verification}${encodeURIComponent(t.reference)}`;
    const qr = qrEscpos(url);
    const total = new Uint8Array(texte.length + qr.length + 7);
    total.set(texte, 0);
    total.set(qr, texte.length);
    total.set(coupeEscpos(), texte.length + qr.length);
    return total;
  }
  const total = new Uint8Array(texte.length + 7);
  total.set(texte, 0);
  total.set(coupeEscpos(), texte.length);
  return total;
}

/* ---------------------------------------------------------------------
 * Gabarits HTML (impression navigateur / PDF) — FR & AR (RTL)
 * ------------------------------------------------------------------- */

type Langue = "fr" | "ar";

const T: Record<Langue, Record<string, string>> = {
  fr: {
    ticket: "TICKET DE PAIEMENT",
    bon: "BON D'INTERVENTION ATELIER",
    avisBon: "Ce bon d'intervention ne vaut ni facture ni ticket de paiement.",
    numero: "N° document",
    date: "Date",
    caissier: "Caissier",
    client: "Client",
    vehicule: "Véhicule",
    articles: "Articles",
    reference: "Réf.",
    total: "Total TTC",
    paye: "Payé",
    reste: "Reste à payer",
    monnaie: "Monnaie rendue",
    remise: "Remise",
    transaction: "Transaction",
    reimpression: "RÉIMPRESSION",
    merci: "Merci de votre confiance",
    verif: "Vérification du document",
    motif: "Motif de visite",
    diagnostic: "Diagnostic",
    travaux: "Travaux demandés",
    pieces: "Pièces nécessaires",
    mainOeuvre: "Main-d'œuvre",
    technicien: "Technicien responsable",
    statut: "Statut de l'intervention",
    livraison: "Date prévue de livraison",
    observations: "Observations et réserves",
    validation: "Validation client (si le processus le prévoit)",
    approuve: "Client informé et approuvé",
    nonApprouve: "En attente de validation client",
    km: "km",
    sign: "Signature client :",
    ventesLiees: "Ventes liées (POS)",
    aucune: "—",
  },
  ar: {
    ticket: "وصل الأداء",
    bon: "بطاقة التدخل بالورشة",
    avisBon: "بطاقة التدخل ليست فاتورة ولا وصل أداء.",
    numero: "رقم الوثيقة",
    date: "التاريخ",
    caissier: "الأمين صندوق",
    client: "الزبون",
    vehicule: "السيارة",
    articles: "المواد",
    reference: "المرجع",
    total: "المجموع بالضريبة",
    paye: "المدفوع",
    reste: "المتبقي",
    monnaie: "الباقي المرتد",
    remise: "التخفيض",
    transaction: "العملية",
    reimpression: "إعادة طبع",
    merci: "شكرا لثقتكم",
    verif: "التحقق من الوثيقة",
    motif: "سبب الزيارة",
    diagnostic: "التشخيص",
    travaux: "الأعمال المطلوبة",
    pieces: "القطع اللازمة",
    mainOeuvre: "أجر الصنعة",
    technicien: "التقني المسؤول",
    statut: "حالة التدخل",
    livraison: "تاريخ التسليم المتوقع",
    observations: "ملاحظات وتحفظات",
    validation: "تصديق الزبون (إن كان الإجراء يقتضيه)",
    approuve: "الزبون على علم ووافق",
    nonApprouve: "في انتظار موافقة الزبون",
    km: "كم",
    sign: "توقيع الزبون :",
    ventesLiees: "المبيعات المرتبطة (نقطة البيع)",
    aucune: "—",
  },
};

const STYLE_TICKET = `
  @page { margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", "Cairo", "Tahoma", monospace; color: #000; background: #fff; margin: 0; }
  .ticket { width: 100%; max-width: 72mm; margin: 0 auto; }
  .ticket.f80 { max-width: 80mm; }
  .centre { text-align: center; }
  .gras { font-weight: 700; }
  .grande { font-size: 1.25em; }
  .petit { font-size: 0.78em; }
  .row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .droite { text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82em; }
  th, td { text-align: left; padding: 2px 0; }
  .rtl table th, .rtl table td { text-align: right; }
  .num { white-space: nowrap; }
  @media print { body { -webkit-print-color-adjust: exact; } }
`;

function enTeteEtabHtml(etab: Etablissement, l: Langue): string {
  const adresse = [etab.adresse, etab.ville].filter(Boolean).join(", ");
  return `
    <div class="centre">
      <div class="gras grande">${echapperHtml(etab.nom)}</div>
      ${adresse ? `<div class="petit">${echapperHtml(adresse)}</div>` : ""}
      ${etab.telephone ? `<div class="petit">${echapperHtml(l === "ar" ? `الهاتف : ${etab.telephone}` : `Tél : ${etab.telephone}`)}</div>` : ""}
      ${etab.email ? `<div class="petit">${echapperHtml(etab.email)}</div>` : ""}
    </div>`;
}

/** QR en HTML : uniquement si l'établissement a configuré une URL de
 *  vérification RÉELLE. Sinon rien (pas de QR décoratif). */
function qrHtml(etab: Etablissement, donnees: string, t: Record<string, string>): string {
  if (!etab.url_verification) return "";
  const url = `${etab.url_verification}${encodeURIComponent(donnees)}`;
  return `
    <div class="sep"></div>
    <div class="centre petit">
      <div>${echapperHtml(t.verif)}</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}" alt="QR ${echapperHtml(donnees)}" width="140" height="140" />
      <div>${echapperHtml(url)}</div>
    </div>`;
}

export function echapperHtml(s: string): string {
  return String(s ?? "")
    .split("&").join("&" + "amp;")
    .split("<").join("&" + "lt;")
    .split(">").join("&" + "gt;")
    .split('"').join("&" + "quot;");
}

/** Gabarit HTML du TICKET DE PAIEMENT (navigateur / PDF). */
export function modeleTicketHtml(
  t: DonneesTicket,
  etab: Etablissement,
  langue: Langue,
  format: FormatPapier,
  opts?: { copies?: number; imprimerAuto?: boolean },
): string {
  const copies = Math.max(1, opts?.copies ?? 1);
  const imprimerAuto = opts?.imprimerAuto !== false;
  const tr = T[langue];
  const rtl = langue === "ar";
  const totalTva = t.lignes.reduce((s, l) => s + l.quantite * l.prix * ((l.tvaPct ?? 0) / 100), 0);
  const remiseLignes = t.lignes.reduce((s, l) => s + l.quantite * l.prix * ((l.remisePct ?? 0) / 100), 0);

  const lignesHtml = t.lignes
    .map(
      (l) => `
      <tr>
        <td>${echapperHtml(l.nom)}${l.reference ? `<div class="petit">${tr.reference}: ${echapperHtml(l.reference)}</div>` : ""}</td>
        <td class="num">${l.quantite} × ${mad(l.prix)}</td>
        <td class="num droite">${mad(l.quantite * l.prix * (1 - (l.remisePct ?? 0) / 100))}</td>
      </tr>`,
    )
    .join("");

  const reglementsHtml = traduireReglements(t.reglements, langue)
    .map((r) => `<div class="row"><span>${tr.paye} (${echapperHtml(r.methode)})</span><span class="num">${mad(r.montant)}</span></div>`)
    .join("");

  const blocTicket = () => `
<div class="ticket ${format === "80mm" ? "f80" : ""}">
  ${enTeteEtabHtml(etab, langue)}
  <div class="sep"></div>
  <div class="centre gras">${tr.ticket}</div>
  <div class="centre petit">${tr.numero} : ${echapperHtml(t.reference)}</div>
  ${t.reimpression ? `<div class="centre petit gras">${tr.reimpression} n°${t.reimpression} — ${tr.numero} initial : ${echapperHtml(t.reference)}</div>` : ""}
  <div class="petit">${tr.date} : ${echapperHtml(t.date)}</div>
  ${t.caissier ? `<div class="petit">${tr.caissier} : ${echapperHtml(t.caissier)}</div>` : ""}
  <div class="petit">${tr.client} : ${echapperHtml(t.client ?? (langue === "ar" ? "بالكونتر" : "Comptoir"))}</div>
  ${t.vehicule ? `<div class="petit">${tr.vehicule} : ${echapperHtml(t.vehicule)}${t.vehiculeDetails ? ` — ${echapperHtml(t.vehiculeDetails)}` : ""}</div>` : ""}
  <div class="sep"></div>
  <table>
    <thead><tr><th>${tr.articles}</th><th></th><th class="droite">${langue === "ar" ? "المبلغ" : "Montant"}</th></tr></thead>
    <tbody>${lignesHtml}</tbody>
  </table>
  <div class="sep"></div>
  ${remiseLignes > 0 ? `<div class="row"><span>${tr.remise}</span><span class="num">- ${mad(remiseLignes + (t.remiseTicket || 0))}</span></div>` : t.remiseTicket > 0 ? `<div class="row"><span>${tr.remise}</span><span class="num">- ${mad(t.remiseTicket)}</span></div>` : ""}
  <div class="row petit"><span>TVA</span><span class="num">${mad(totalTva)}</span></div>
  <div class="row gras grande"><span>${tr.total}</span><span class="num">${mad(t.totalTTC)}</span></div>
  <div class="sep"></div>
  ${reglementsHtml}
  ${t.monnaie > 0 ? `<div class="row"><span>${tr.monnaie}</span><span class="num">${mad(t.monnaie)}</span></div>` : ""}
  ${t.reste > 0 ? `<div class="row gras"><span>${tr.reste}</span><span class="num">${mad(t.reste)}</span></div>` : ""}
  ${t.referenceTransaction ? `<div class="petit">${tr.transaction} : ${echapperHtml(t.referenceTransaction)}</div>` : ""}
  ${qrHtml(etab, t.reference, tr)}
  <div class="sep"></div>
  <div class="centre petit">${tr.merci}</div>
</div>`;

  const repetitions = Array.from({ length: copies }, (_, i) => {
    const bloc = blocTicket();
    return i < copies - 1 ? bloc.replace('<div class="ticket', '<div style="page-break-after:always" class="ticket') : bloc;
  }).join("\n");

  return `<!doctype html>
<html lang="${langue}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${tr.ticket} ${echapperHtml(t.reference)}</title>
<style>${STYLE_TICKET}</style>
</head>
<body class="${rtl ? "rtl" : ""}">
${repetitions}
${imprimerAuto ? `<script>window.onload = function () { window.focus(); window.print(); };</script>` : ""}
</body>
</html>`;
}

/** Gabarit HTML du BON D'INTERVENTION — formats thermique (58/80) et A4.
 *  Ce document n'est NI une facture NI un ticket de paiement (mention
 *  explicite en pied de page). */
export function modeleBonInterventionHtml(
  b: DonneesBon,
  etab: Etablissement,
  langue: Langue,
  format: FormatPapier,
  opts?: { copies?: number; imprimerAuto?: boolean },
): string {
  const tr = T[langue];
  const rtl = langue === "ar";
  const thermique = format !== "A4";

  const totalMainOeuvre = (b.mainOeuvre || []).reduce((s, x) => s + Number(x.prix || 0), 0);
  const totalPieces = (b.pieces || []).reduce((s, x) => s + Number(x.prix || 0), 0);

  function sectionListe(titre: string, lignes: LigneBon[], montrerPrix: boolean): string {
    if (!lignes || lignes.length === 0) return `<p class="petit">${titre} : ${tr.aucune}</p>`;
    return `
      <p class="gras petit" style="margin:6px 0 2px">${titre}</p>
      <table>
        <tbody>
          ${lignes
            .map(
              (x) => `<tr>
                <td>${echapperHtml(x.label)}${x.statut ? ` <span class="petit">(${echapperHtml(x.statut)})</span>` : ""}</td>
                ${montrerPrix ? `<td class="num droite">${x.prix != null ? mad(Number(x.prix)) : tr.aucune}</td>` : ""}
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  }

  const corps = `
    ${enTeteEtabHtml(etab, langue)}
    <div class="sep"></div>
    <div class="centre gras grande">${tr.bon}</div>
    <div class="centre petit">${tr.numero} : <span class="gras">${echapperHtml(b.reference)}</span></div>
    <div class="petit">${tr.date} : ${echapperHtml(b.dateOuverture)}</div>
    <div class="sep"></div>
    <div class="row"><span>${tr.client}</span><span class="gras">${echapperHtml(b.client ?? tr.aucune)}</span></div>
    ${b.telephoneClient ? `<div class="row petit"><span></span><span>${echapperHtml(b.telephoneClient)}</span></div>` : ""}
    <div class="row"><span>${tr.vehicule}</span><span>${echapperHtml([b.vehicule.marque, b.vehicule.modele].filter(Boolean).join(" ") || tr.aucune)}</span></div>
    <div class="row petit"><span></span><span>${echapperHtml(b.vehicule.plaque ?? tr.aucune)}${b.vehicule.kilometrage != null ? ` — ${b.vehicule.kilometrage.toLocaleString("fr-FR")} ${tr.km}` : ""}</span></div>
    ${b.motif ? `<div class="petit" style="margin-top:4px"><span class="gras">${tr.motif} :</span> ${echapperHtml(b.motif)}</div>` : ""}
    ${b.diagnostic ? `<div class="petit"><span class="gras">${tr.diagnostic} :</span> ${echapperHtml(b.diagnostic)}</div>` : ""}
    <div class="sep"></div>
    ${sectionListe(tr.travaux, b.travaux, false)}
    ${sectionListe(tr.pieces, b.pieces, true)}
    ${sectionListe(tr.mainOeuvre, b.mainOeuvre, true)}
    ${(b.pieces?.length || b.mainOeuvre?.length) && (totalPieces > 0 || totalMainOeuvre > 0) ? `
      <div class="sep"></div>
      ${totalPieces > 0 ? `<div class="row"><span>${tr.pieces}</span><span class="num">${mad(totalPieces)}</span></div>` : ""}
      ${totalMainOeuvre > 0 ? `<div class="row"><span>${tr.mainOeuvre}</span><span class="num">${mad(totalMainOeuvre)}</span></div>` : ""}
      <div class="row gras"><span>${langue === "ar" ? "الإجمالي التقديري" : "Total estimé (hors remises)"}</span><span class="num">${mad(totalPieces + totalMainOeuvre)}</span></div>
      <p class="petit">${langue === "ar" ? "المبالغ تقديرية — الفاتورة النهائية تُصدر عند التسليم." : "Montants indicatifs — la facture définitive est émise à la livraison."}</p>` : ""}
    ${b.ventesLiees && b.ventesLiees.length ? `<div class="petit">${tr.ventesLiees} : ${b.ventesLiees.map(echapperHtml).join(", ")}</div>` : ""}
    <div class="sep"></div>
    <div class="row"><span>${tr.technicien}</span><span>${echapperHtml(b.technicien ?? tr.aucune)}</span></div>
    <div class="row"><span>${tr.statut}</span><span class="gras">${echapperHtml(libelleStatut(b.statut, langue))}</span></div>
    <div class="row"><span>${tr.livraison}</span><span>${echapperHtml(b.livraisonPrevue ?? tr.aucune)}</span></div>
    ${b.observations ? `<div class="petit" style="margin-top:4px"><span class="gras">${tr.observations} :</span> ${echapperHtml(b.observations)}</div>` : ""}
    <div class="petit" style="margin-top:6px">${tr.validation} : <span class="gras">${b.clientApprouve ? tr.approuve : tr.nonApprouve}</span></div>
    ${qrHtml(etab, b.reference, tr)}
    ${thermique ? "" : `<div style="margin-top:28px;display:flex;gap:24px"><div style="flex:1;border-top:1px solid #000;padding-top:4px" class="petit">${tr.sign}</div></div>`}
    <div class="sep"></div>
    <div class="centre petit gras">${tr.avisBon}</div>`;

  const style = thermique
    ? STYLE_TICKET
    : `${STYLE_TICKET}
       @page { size: A4; margin: 14mm; }
       body { font-family: "Cairo", "Tahoma", Arial, sans-serif; }
       .ticket { max-width: 180mm; font-size: 12px; }
       table { font-size: 12px; }
       th, td { border-bottom: 1px solid #ddd; padding: 4px 0; }`;

  const copies = Math.max(1, opts?.copies ?? 1);
  const imprimerAuto = opts?.imprimerAuto !== false;
  const repetitions = Array.from({ length: copies }, (_, i) => {
    const bloc = `<div class="ticket ${format === "80mm" ? "f80" : ""}">${corps}</div>`;
    return i < copies - 1 ? bloc.replace('<div class="ticket', '<div style="page-break-after:always" class="ticket') : bloc;
  }).join("\n");

  return `<!doctype html>
<html lang="${langue}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${tr.bon} ${echapperHtml(b.reference)}</title>
<style>${style}</style>
</head>
<body class="${rtl ? "rtl" : ""}">
${repetitions}
${imprimerAuto ? `<script>window.onload = function () { window.focus(); window.print(); };</script>` : ""}
</body>
</html>`;
}

/** Page de test d'impression — vérifie largeur, gras, coupure, QR si configuré. */
export function modeleTestHtml(
  etab: Etablissement,
  langue: Langue,
  format: FormatPapier,
  opts?: { copies?: number; imprimerAuto?: boolean },
): string {
  const copies = Math.max(1, opts?.copies ?? 1);
  const imprimerAuto = opts?.imprimerAuto !== false;
  const tr = T[langue];
  const rtl = langue === "ar";
  const date = new Date().toLocaleString(langue === "ar" ? "ar-MA" : "fr-FR");
  const blocTest = () => `
<div class="ticket ${format === "80mm" ? "f80" : ""}">
  ${enTeteEtabHtml(etab, langue)}
  <div class="sep"></div>
  <div class="centre gras">${langue === "ar" ? "صفحة اختبار الطباعة" : "PAGE DE TEST D'IMPRESSION"}</div>
  <div class="centre petit">${FORMAT_LABEL[format]} · ${date}</div>
  <div class="sep"></div>
  <div>0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
  <div class="gras">Gras — ${langue === "ar" ? "نص عريض" : "texte en gras"}</div>
  <div class="gras grande">Grand — ${langue === "ar" ? "كبير" : "grand"}</div>
  ${"M".repeat(colonnesEscpos(format) || 40)}
  <div class="sep"></div>
  ${qrHtml(etab, `test-${Date.now()}`, tr)}
  <div class="centre petit">${tr.merci}</div>
</div>`;
  const repetitions = Array.from({ length: copies }, (_, i) => {
    const bloc = blocTest();
    return i < copies - 1 ? bloc.replace('<div class="ticket', '<div style="page-break-after:always" class="ticket') : bloc;
  }).join("\n");
  return `<!doctype html>
<html lang="${langue}" dir="${rtl ? "rtl" : "ltr"}">
<head><meta charset="utf-8" /><title>${DOCUMENT_LABEL.test}</title><style>${STYLE_TICKET}</style></head>
<body class="${rtl ? "rtl" : ""}">
${repetitions}
${imprimerAuto ? `<script>window.onload = function () { window.focus(); window.print(); };</script>` : ""}
</body>
</html>`;
}

/* ---------------------------------------------------------------------
 * Traductions des moyens de paiement (ticket lisible)
 * ------------------------------------------------------------------- */

export const METHODE_LABEL: Record<Langue, Record<string, string>> = {
  fr: {
    especes: "Espèces", cash: "Espèces", carte: "Carte", card: "Carte",
    cheque: "Chèque", virement: "Virement", transfer: "Virement",
    mobile: "Mobile", partiel: "Partiel", credit: "Crédit",
  },
  ar: {
    especes: "نقدا", cash: "نقدا", carte: "بطاقة", card: "بطاقة",
    cheque: "شيك", virement: "تحويل بنكي", transfer: "تحويل بنكي",
    mobile: "موبايل", partiel: "جزئي", credit: "بالدين",
  },
};

export function libelleMethode(m: string, langue: Langue): string {
  return METHODE_LABEL[langue][m] ?? m;
}

/** Traduit les réglements d'un ticket avant rendu (libellés lisibles). */
export function traduireReglements(reglements: ReglementTicket[], langue: Langue): ReglementTicket[] {
  return reglements.map((r) => ({ ...r, methode: libelleMethode(r.methode, langue) }));
}
