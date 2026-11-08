/**
 * AUTO DYALI PRINT PRO — client (Supabase + navigateur).
 *
 * Complète la logique pure de `print-pro.ts` avec :
 * - le chargement de la configuration d'imprimantes de l'établissement
 *   (migration 0024 — table `printer_configs`) ;
 * - la journalisation TRACÉE des impressions (table `print_jobs`,
 *   compteur de réimpressions via RPC `count_print_jobs`) ;
 * - les voies d'impression réellement disponibles dans un navigateur :
 *   · navigateur : popup + dialogue système / PDF (toujours disponible) ;
 *   · USB : WebUSB (Chrome/Edge desktop) — l'utilisateur choisit et
 *     autorise l'appareil à CHAQUE appairage ;
 *   · Bluetooth : Web Bluetooth (Chrome/Edge, appareils compatibles) ;
 *   · réseau : AUCUN socket TCP possible — l'impression réseau passe par
 *     le pilote du poste ; l'adresse stockée est indicative ;
 *   · repli universel : téléchargement du payload ESC/POS en .bin.
 */

import { supabase } from "@/lib/supabase-browser";
import type { ConnexionImprimante, FormatPapier, TypeDocument } from "./print-pro";

export type ImprimanteRow = {
  id: string;
  establishment_id: string;
  label: string;
  connexion: ConnexionImprimante;
  format: FormatPapier;
  est_defaut_ticket_vente: boolean;
  est_defaut_bon_intervention: boolean;
  est_defaut_devis: boolean;
  est_defaut_facture: boolean;
  copies_par_defaut: number;
  langue_defaut: "fr" | "ar";
  usb_vendor_id: string | null;
  usb_product_id: string | null;
  adresse_reseau: string | null;
  actif: boolean;
  notes: string | null;
};

export async function etablissementCourant(): Promise<{ id: string; nom: string; adresse: string | null; ville: string | null; telephone: string | null; email: string | null } | null> {
  if (!supabase) return null;
  const { data: profil } = await supabase.rpc("get_my_profile");
  const id = profil?.[0]?.establishment_id;
  if (!id) return null;
  const { data: etab } = await supabase
    .from("establishments")
    .select("id, name, address, city, phone, email")
    .eq("id", id)
    .single();
  if (!etab) return null;
  return {
    id: etab.id,
    nom: etab.name ?? "AUTO DYALI",
    adresse: etab.address ?? null,
    ville: etab.city ?? null,
    telephone: etab.phone ?? null,
    email: etab.email ?? null,
  };
}

export async function chargerImprimantes(etablissementId: string): Promise<ImprimanteRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("printer_configs")
    .select("*")
    .eq("establishment_id", etablissementId)
    .order("created_at");
  if (error) {
    // Migration 0024 pas encore exécutée : liste vide, message clair.
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ImprimanteRow[];
}

/** Imprimante par défaut pour un type de document, sinon la première active. */
export function imprimanteParDefaut(imprimantes: ImprimanteRow[], type: TypeDocument): ImprimanteRow | null {
  const actives = imprimantes.filter((p) => p.actif);
  const champ =
    type === "ticket_vente" ? "est_defaut_ticket_vente"
    : type === "bon_intervention" ? "est_defaut_bon_intervention"
    : type === "devis" ? "est_defaut_devis"
    : "est_defaut_facture";
  return actives.find((p) => p[champ]) ?? actives[0] ?? null;
}

export type MetaTravail = {
  documentType: TypeDocument;
  reference: string;
  saleId?: string | null;
  quoteId?: string | null;
  workOrderId?: string | null;
  reimpression?: number;
  status?: "ok" | "erreur";
  errorMessage?: string | null;
};

/** Journalise une impression (toujours, même en cas d'erreur — tracé). */
export async function journaliserImpression(
  etablissementId: string,
  imprimante: ImprimanteRow | null,
  meta: MetaTravail,
  format: FormatPapier,
  langue: "fr" | "ar",
  copies: number,
): Promise<void> {
  if (!supabase) return;
  const { data: profil } = await supabase.rpc("get_my_profile");
  await supabase.from("print_jobs").insert({
    establishment_id: etablissementId,
    document_type: meta.documentType,
    reference: meta.reference,
    sale_id: meta.saleId ?? null,
    quote_id: meta.quoteId ?? null,
    work_order_id: meta.workOrderId ?? null,
    printer_id: imprimante?.id ?? null,
    printer_label: imprimante?.label ?? null,
    format,
    langue,
    copies,
    voie: imprimante?.connexion ?? "navigateur",
    reimpression: meta.reimpression ?? 0,
    status: meta.status ?? "ok",
    error_message: meta.errorMessage ?? null,
    printed_by: profil?.[0]?.id ?? null,
  });
}

/** Nombre d'impressions déjà réalisées pour ce document (réimpressions). */
export async function compterImpressions(reference: string, documentType: TypeDocument): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("count_print_jobs", {
    p_reference: reference,
    p_document_type: documentType,
  });
  if (error) return 0; // RPC absente (0024 pas exécutée) → première impression
  return Number(data ?? 0);
}

/** Ouvre le document HTML dans une popup et déclenche le dialogue système
 *  (impression navigateur / PDF). Fonctionne partout. */
export function ouvrirImpressionNavigateur(html: string): { ok: boolean; message?: string } {
  const fenetre = window.open("", "_blank", "width=460,height=720");
  if (!fenetre) {
    return { ok: false, message: "Autorisez les fenêtres pop-up pour imprimer." };
  }
  fenetre.document.open();
  fenetre.document.write(html);
  fenetre.document.close();
  return { ok: true };
}

/** Prévisualisation : popup SANS impression automatique. */
export function ouvrirApercu(html: string): { ok: boolean; message?: string } {
  return ouvrirImpressionNavigateur(html);
}

async function transfererUsb(payload: Uint8Array, vendorId?: string | null, productId?: string | null): Promise<void> {
  const usb = (navigator as unknown as { usb?: { requestDevice: (o: unknown) => Promise<USBDeviceLike> } }).usb;
  if (!usb) {
    throw new Error(
      "WebUSB indisponible dans ce navigateur — utilisez Chrome ou Edge sur ordinateur, ou imprimez via le dialogue système.",
    );
  }
  const filtres = vendorId && productId
    ? [{ vendorId: parseInt(vendorId, 16), productId: parseInt(productId, 16) }]
    : [];
  const appareil = await usb.requestDevice({ filters: filtres });
  await appareil.open();
  await appareil.selectConfiguration(1);
  // Cherche une interface avec un endpoint bulk OUT (standard ESC/POS).
  let interfaceNumber = -1;
  let endpointNumber = -1;
  for (const conf of appareil.configurations) {
    for (const iface of conf.interfaces) {
      for (const alt of iface.alternates) {
        const out = alt.endpoints.find((e) => e.type === "bulk" && e.direction === "out");
        if (out) {
          interfaceNumber = iface.interfaceNumber;
          endpointNumber = out.endpointNumber;
          break;
        }
      }
      if (interfaceNumber >= 0) break;
    }
    if (interfaceNumber >= 0) break;
  }
  if (interfaceNumber < 0) throw new Error("Aucun endpoint d'impression (bulk OUT) détecté sur cet appareil.");
  await appareil.claimInterface(interfaceNumber);
  // Envoi par paquets de 512 octets (limite pratique des firmwares).
  for (let i = 0; i < payload.length; i += 512) {
    await appareil.transferOut(endpointNumber, payload.slice(i, i + 512));
  }
  await appareil.close();
}

type USBDeviceLike = {
  configurations: Array<{
    interfaces: Array<{
      interfaceNumber: number;
      alternates: Array<{
        endpoints: Array<{ type: string; direction: string; endpointNumber: number }>;
      }>;
    }>;
  }>;
  open: () => Promise<void>;
  selectConfiguration: (n: number) => Promise<void>;
  claimInterface: (n: number) => Promise<void>;
  transferOut: (endpoint: number, data: Uint8Array) => Promise<unknown>;
  close: () => Promise<void>;
};

/** Impression ESC/POS par USB (WebUSB). Demande l'appairage à l'utilisateur. */
export async function imprimerEscposUsb(payload: Uint8Array, imprimante?: ImprimanteRow | null): Promise<void> {
  try {
    await transfererUsb(payload, imprimante?.usb_vendor_id, imprimante?.usb_product_id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur USB inconnue.";
    throw new Error(
      message.includes("indisponible") ? message
        : message.includes("No device selected") || message.includes("User cancelled")
        ? "Aucune imprimante sélectionnée (appairage annulé)."
        : `Échec USB : ${message}`,
    );
  }
}

const SERVICES_BT = [
  "0000ff00-0000-1000-8000-00805f9b34fb",   // courant sur imprimantes thermiques BLE
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

type BluetoothCharacteristicLike = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue: (data: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>;
};

type BluetoothDeviceLike = {
  gatt?: {
    connect: () => Promise<{
      getPrimaryServices: () => Promise<Array<{
        getCharacteristics: () => Promise<BluetoothCharacteristicLike[]>;
      }>>;
    }>;
    disconnect: () => void;
  };
};

/** Impression ESC/POS par Bluetooth LE (Web Bluetooth — best effort :
 *  dépend du matériel et de l'accord utilisateur à chaque appairage). */
export async function imprimerEscposBluetooth(payload: Uint8Array): Promise<void> {
  const bt = (navigator as unknown as { bluetooth?: { requestDevice: (o: unknown) => Promise<BluetoothDeviceLike> } }).bluetooth;
  if (!bt) {
    throw new Error(
      "Web Bluetooth indisponible dans ce navigateur — utilisez Chrome ou Edge, ou imprimez via le dialogue système.",
    );
  }
  let appareil: BluetoothDeviceLike;
  try {
    appareil = await bt.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES_BT });
  } catch {
    throw new Error("Aucune imprimante sélectionnée (appairage annulé).");
  }
  if (!appareil.gatt) throw new Error("Cet appareil n'expose pas GATT (Bluetooth classique non pris en charge).");
  const serveur = await appareil.gatt.connect();
  try {
    const services = await serveur.getPrimaryServices();
    let caracteristique: BluetoothCharacteristicLike | null = null;
    for (const service of services) {
      for (const c of await service.getCharacteristics()) {
        if (c.properties.write || c.properties.writeWithoutResponse) { caracteristique = c; break; }
      }
      if (caracteristique) break;
    }
    if (!caracteristique) throw new Error("Aucune caractéristique d'écriture détectée sur cette imprimante.");
    for (let i = 0; i < payload.length; i += 100) {
      const morceau = payload.slice(i, i + 100);
      if (caracteristique.writeValueWithoutResponse) await caracteristique.writeValueWithoutResponse(morceau);
      else await caracteristique.writeValue(morceau);
    }
  } finally {
    appareil.gatt.disconnect();
  }
}

/** Repli universel : télécharger le payload ESC/POS pour l'envoyer à
 *  l'imprimante via le pilote du poste. */
export function telechargerEscpos(payload: Uint8Array, nomFichier: string): void {
  const blob = new Blob([payload as unknown as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Route une impression ESC/POS selon la connexion configurée, avec
 *  messages honnêtes en cas de limite navigateur. */
export async function envoyerEscpos(payload: Uint8Array, imprimante: ImprimanteRow | null, nomFichier: string): Promise<{ voie: ConnexionImprimante; message?: string }> {
  const connexion = imprimante?.connexion ?? "navigateur";
  if (connexion === "usb") {
    await imprimerEscposUsb(payload, imprimante);
    return { voie: "usb" };
  }
  if (connexion === "bluetooth") {
    await imprimerEscposBluetooth(payload);
    return { voie: "bluetooth" };
  }
  // navigateur / reseau : pas d'accès direct ESC/POS → téléchargement .bin
  telechargerEscpos(payload, nomFichier);
  return {
    voie: connexion,
    message:
      connexion === "reseau"
        ? "Payload .bin téléchargé — l'impression réseau passe par le pilote du poste (pas de socket TCP depuis un navigateur)."
        : "Payload .bin téléchargé — pour l'envoi direct USB/Bluetooth, utilisez Chrome ou Edge.",
  };
}
