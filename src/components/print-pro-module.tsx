"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import {
  CONNEXION_LABEL,
  DOCUMENT_LABEL,
  FORMAT_LABEL,
  modeleTestHtml,
  lignesEscpos,
  type ConnexionImprimante,
  type FormatPapier,
  type TypeDocument,
} from "@/lib/print-pro";
import {
  chargerImprimantes,
  envoyerEscpos,
  etablissementCourant,
  journaliserImpression,
  ouvrirImpressionNavigateur,
  type ImprimanteRow,
} from "@/lib/print-pro-client";

/**
 * AUTO DYALI PRINT PRO — administration des imprimantes.
 *
 * Configuration par établissement (migration 0024) :
 * imprimantes 58/80 mm et A4, imprimante par défaut par type de document,
 * copies, langue, test d'impression, historique tracé avec réimpression,
 * et limites navigateur affichées honnêtement.
 */

type Etat = { id: string; nom: string; adresse: string | null; ville: string | null; telephone: string | null; email: string | null };

type TravailRow = {
  id: string;
  document_type: TypeDocument;
  reference: string;
  printer_label: string | null;
  format: FormatPapier;
  langue: string;
  copies: number;
  voie: string;
  reimpression: number;
  status: string;
  error_message: string | null;
  created_at: string;
};

const VIDE = {
  label: "",
  connexion: "navigateur" as ConnexionImprimante,
  format: "80mm" as FormatPapier,
  est_defaut_ticket_vente: false,
  est_defaut_bon_intervention: false,
  est_defaut_devis: false,
  est_defaut_facture: false,
  copies_par_defaut: 1,
  langue_defaut: "fr" as "fr" | "ar",
  usb_vendor_id: "",
  usb_product_id: "",
  adresse_reseau: "",
  notes: "",
};

/** Référence unique pour les pages de test (module-scope : jamais en rendu). */
function referenceTest(): string {
  return `test-${Date.now()}`;
}

export function PrintProModule() {
  const [chargement, setChargement] = useState(true);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionOk, setPermissionOk] = useState(true);

  const [etab, setEtab] = useState<Etat | null>(null);
  const [imprimantes, setImprimantes] = useState<ImprimanteRow[]>([]);
  const [travaux, setTravaux] = useState<TravailRow[]>([]);
  const [edition, setEdition] = useState<typeof VIDE & { id?: string }>({ ...VIDE });
  const [formOuvert, setFormOuvert] = useState(false);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      if (!supabase) throw new Error("Supabase n'est pas configuré.");
      // Permission : édition du module « pos » requise (comme le POS).
      const profil = await supabase.rpc("get_my_profile");
      const role = profil.data?.[0]?.role;
      if (!role || !["manager", "saas_admin"].includes(role)) {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("module, can_edit")
          .eq("module", "pos")
          .limit(1);
        if (!perms?.[0]?.can_edit) {
          setPermissionOk(false);
          setChargement(false);
          return;
        }
      }
      const e = await etablissementCourant();
      if (!e) throw new Error("Établissement introuvable.");
      setEtab(e);
      setImprimantes(await chargerImprimantes(e.id));
      const { data: jobs } = await supabase
        .from("print_jobs")
        .select("*")
        .eq("establishment_id", e.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTravaux((jobs ?? []) as TravailRow[]);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(t);
  }, []);

  async function enregistrerImprimante(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !etab) return;
    setEnregistre(true);
    setErreur(null);
    setMessage(null);
    try {
      const payload = {
        establishment_id: etab.id,
        label: edition.label.trim(),
        connexion: edition.connexion,
        format: edition.format,
        est_defaut_ticket_vente: edition.est_defaut_ticket_vente,
        est_defaut_bon_intervention: edition.est_defaut_bon_intervention,
        est_defaut_devis: edition.est_defaut_devis,
        est_defaut_facture: edition.est_defaut_facture,
        copies_par_defaut: edition.copies_par_defaut,
        langue_defaut: edition.langue_defaut,
        usb_vendor_id: edition.usb_vendor_id.trim() || null,
        usb_product_id: edition.usb_product_id.trim() || null,
        adresse_reseau: edition.adresse_reseau.trim() || null,
        notes: edition.notes.trim() || null,
        actif: true,
      };
      if (!payload.label) throw new Error("Le libellé de l'imprimante est requis.");
      const req = edition.id
        ? await supabase.from("printer_configs").update(payload).eq("id", edition.id)
        : await supabase.from("printer_configs").insert(payload);
      if (req.error) throw new Error(req.error.message);
      setMessage(edition.id ? "Imprimante mise à jour." : "Imprimante ajoutée.");
      setEdition({ ...VIDE });
      setFormOuvert(false);
      setImprimantes(await chargerImprimantes(etab.id));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnregistre(false);
    }
  }

  async function desactiverImprimante(p: ImprimanteRow) {
    if (!supabase || !etab) return;
    setEnregistre(true);
    try {
      const { error } = await supabase.from("printer_configs").update({ actif: false }).eq("id", p.id);
      if (error) throw new Error(error.message);
      setMessage(`Imprimante « ${p.label} » désactivée (aucune donnée supprimée).`);
      setImprimantes(await chargerImprimantes(etab.id));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Désactivation impossible.");
    } finally {
      setEnregistre(false);
    }
  }

  /** Test d'impression : HTML via navigateur, ou ESC/POS selon la connexion. */
  async function testerImprimante(p: ImprimanteRow) {
    if (!etab || !supabase) return;
    setErreur(null);
    setMessage(null);
    try {
      if (p.format === "A4" || p.connexion === "navigateur" || p.connexion === "reseau") {
        const html = modeleTestHtml(
          { nom: etab.nom, adresse: etab.adresse, ville: etab.ville, telephone: etab.telephone, email: etab.email },
          p.langue_defaut,
          p.format,
          { copies: 1, imprimerAuto: true },
        );
        const res = ouvrirImpressionNavigateur(html);
        if (!res.ok) throw new Error(res.message ?? "Impression impossible.");
        setMessage(`Page de test envoyée au dialogue ${p.format === "A4" ? "d'impression / PDF" : "d'impression système"}.`);
      } else {
        const blocs = [
          { texte: etab.nom, aligne: "centre" as const, gras: true },
          { texte: `Test ${FORMAT_LABEL[p.format]} — ${p.label}` },
          { texte: "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
          { texte: new Date().toLocaleString("fr-FR") },
          { texte: "Merci de votre confiance !", aligne: "centre" as const },
        ];
        const payload = lignesEscpos(blocs, p.format);
        const res = await envoyerEscpos(payload, p, `test-${p.format}.bin`);
        setMessage(res.message ?? `Test envoyé via ${p.connexion}.`);
      }
      await journaliserImpression(etab.id, p, { documentType: "test", reference: referenceTest() }, p.format, p.langue_defaut, 1);
      const { data: jobs } = await supabase
        .from("print_jobs")
        .select("*")
        .eq("establishment_id", etab.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTravaux((jobs ?? []) as TravailRow[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test impossible.";
      setErreur(msg);
      if (etab) await journaliserImpression(etab.id, p, { documentType: "test", reference: referenceTest(), status: "erreur", errorMessage: msg }, p.format, p.langue_defaut, 1);
    }
  }

  function reimprimer(travail: TravailRow) {
    // Les tickets se réimpriment depuis « Historique des ventes » (données
    // réelles de la vente rechargées, numéro initial conservé, tracé) ;
    // les bons d'intervention depuis le module Atelier.
    setMessage(
      travail.document_type === "ticket_vente"
        ? "Réimpression des tickets : ouvrez « Historique des ventes » → bouton Ticket sur la vente concernée."
        : travail.document_type === "bon_intervention"
        ? "Réimpression des bons : ouvrez « Atelier » → fiche de l'ordre → bouton Bon."
        : "Ce document se réimprime depuis son module d'origine.",
    );
  }

  if (!permissionOk) {
    return (
      <div className="carte p-8 text-center">
        <p className="text-sm text-[#a8bb87]">
          Permission requise : la gestion des imprimantes est réservée aux profils
          disposant de l&apos;édition du module « Point de vente ». Demandez à un gestionnaire.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {erreur && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{erreur}</p>}
      {message && <p role="status" className="rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{message}</p>}

      {/* Limites navigateur — honnêteté produit */}
      <section className="carte p-5">
        <p className="text-xs uppercase tracking-[0.15em] text-[#a8bb87]">Ce qu&apos;un navigateur sait faire (et ne sait pas)</p>
        <ul className="mt-2 space-y-1 text-sm text-[#a8bb87]">
          <li>✅ <strong className="text-[#f8ecc9]">Navigateur / PDF</strong> — partout : le document s&apos;ouvre et le dialogue système imprime ou enregistre en PDF.</li>
          <li>✅ <strong className="text-[#f8ecc9]">ESC/POS USB</strong> — Chrome / Edge sur ordinateur uniquement, après appairage explicite de l&apos;imprimante.</li>
          <li>✅ <strong className="text-[#f8ecc9]">ESC/POS Bluetooth</strong> — Chrome / Edge, terminaux compatibles (Bluetooth LE, GATT avec écriture).</li>
          <li>❌ <strong className="text-[#f8ecc9]">Réseau local</strong> — aucun socket TCP depuis un navigateur : l&apos;impression passe par le pilote du poste (l&apos;adresse IP stockée est indicative).</li>
          <li>🛟 <strong className="text-[#f8ecc9]">Repli universel</strong> — téléchargement du fichier ESC/POS (.bin) à envoyer via le pilote.</li>
        </ul>
        <p className="mt-2 text-[10px] text-[#90a0b0]">
          Les imprimantes réellement testées sur votre matériel seront consignées dans le rapport de phase —
          aucune compatibilité matérielle n&apos;est annoncée sans test physique.
        </p>
      </section>

      {/* Liste des imprimantes */}
      <section className="carte p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.15em] text-[#a8bb87]">Imprimantes de l&apos;établissement</p>
          <button onClick={() => { setEdition({ ...VIDE }); setFormOuvert(true); }} className="btn-or min-h-10 px-4 py-1.5 text-sm">+ Ajouter</button>
        </div>
        {chargement ? <p className="mt-3 text-sm text-[#a8bb87]">Chargement…</p> : imprimantes.length === 0 ? (
          <p className="mt-3 text-sm text-[#a8bb87]">Aucune imprimante configurée — ajoutez la vôtre (ticket 58/80 mm ou A4).</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {imprimantes.map((p) => (
              <li key={p.id} className={`rounded-lg border border-[#d6b66f]/15 bg-[#21464b]/30 p-3 ${p.actif ? "" : "opacity-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#f8ecc9]">{p.label} {!p.actif && <span className="text-xs text-[#d66868]">(désactivée)</span>}</p>
                    <p className="text-xs text-[#a8bb87]">
                      {FORMAT_LABEL[p.format]} · {CONNEXION_LABEL[p.connexion]} · {p.copies_par_defaut} copie(s) · {p.langue_defaut === "ar" ? "arabe (RTL)" : "français"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#90a0b0]">
                      {[
                        p.est_defaut_ticket_vente ? "défaut tickets" : null,
                        p.est_defaut_bon_intervention ? "défaut bons" : null,
                        p.est_defaut_devis ? "défaut devis" : null,
                        p.est_defaut_facture ? "défaut factures" : null,
                        p.adresse_reseau ? `IP : ${p.adresse_reseau}` : null,
                      ].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => void testerImprimante(p)} disabled={enregistre} className="btn-or min-h-10 px-3 py-1 text-xs disabled:opacity-40">Tester</button>
                    <button
                      onClick={() => {
                        setEdition({
                          id: p.id, label: p.label, connexion: p.connexion, format: p.format,
                          est_defaut_ticket_vente: p.est_defaut_ticket_vente, est_defaut_bon_intervention: p.est_defaut_bon_intervention,
                          est_defaut_devis: p.est_defaut_devis, est_defaut_facture: p.est_defaut_facture,
                          copies_par_defaut: p.copies_par_defaut, langue_defaut: p.langue_defaut,
                          usb_vendor_id: p.usb_vendor_id ?? "", usb_product_id: p.usb_product_id ?? "",
                          adresse_reseau: p.adresse_reseau ?? "", notes: p.notes ?? "",
                        });
                        setFormOuvert(true);
                      }}
                      className="min-h-10 rounded-lg border border-[#d6b66f]/40 px-3 py-1 text-xs text-[#e9d998]"
                    >
                      Modifier
                    </button>
                    {p.actif && (
                      <button onClick={() => void desactiverImprimante(p)} disabled={enregistre} className="min-h-10 rounded-lg bg-[#d66868]/15 px-3 py-1 text-xs text-[#d66868] disabled:opacity-40">Désactiver</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Formulaire d'édition */}
      {formOuvert && (
        <section className="carte p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-[#a8bb87]">{edition.id ? "Modifier l&apos;imprimante" : "Nouvelle imprimante"}</p>
          <form onSubmit={enregistrerImprimante} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="text" placeholder="Libellé (ex. Caisse 1 — 80 mm)" value={edition.label} onChange={(e) => setEdition({ ...edition, label: e.target.value })} className="champ min-h-11" />
            <select value={edition.connexion} onChange={(e) => setEdition({ ...edition, connexion: e.target.value as ConnexionImprimante })} className="champ min-h-11">
              {(Object.keys(CONNEXION_LABEL) as ConnexionImprimante[]).map((c) => <option key={c} value={c}>{CONNEXION_LABEL[c]}</option>)}
            </select>
            <select value={edition.format} onChange={(e) => setEdition({ ...edition, format: e.target.value as FormatPapier })} className="champ min-h-11">
              {(Object.keys(FORMAT_LABEL) as FormatPapier[]).map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
            </select>
            <select value={edition.langue_defaut} onChange={(e) => setEdition({ ...edition, langue_defaut: e.target.value as "fr" | "ar" })} className="champ min-h-11">
              <option value="fr">Français</option>
              <option value="ar">Arabe (RTL)</option>
            </select>
            <select value={edition.copies_par_defaut} onChange={(e) => setEdition({ ...edition, copies_par_defaut: Number(e.target.value) })} className="champ min-h-11">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} copie(s)</option>)}
            </select>
            {(edition.connexion === "usb") && (
              <>
                <input type="text" placeholder="Vendor ID USB (hex, ex. 04b8)" value={edition.usb_vendor_id} onChange={(e) => setEdition({ ...edition, usb_vendor_id: e.target.value })} className="champ min-h-11" />
                <input type="text" placeholder="Product ID USB (hex, ex. 0202)" value={edition.usb_product_id} onChange={(e) => setEdition({ ...edition, usb_product_id: e.target.value })} className="champ min-h-11" />
              </>
            )}
            {(edition.connexion === "reseau") && (
              <input type="text" placeholder="IP du poste / imprimante (indicatif)" value={edition.adresse_reseau} onChange={(e) => setEdition({ ...edition, adresse_reseau: e.target.value })} className="champ min-h-11 sm:col-span-2" />
            )}
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Imprimante par défaut pour</legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {([
                  ["est_defaut_ticket_vente", "Tickets"],
                  ["est_defaut_bon_intervention", "Bons d'intervention"],
                  ["est_defaut_devis", "Devis"],
                  ["est_defaut_facture", "Factures"],
                ] as const).map(([champ, libelle]) => (
                  <label key={champ} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#d6b66f]/20 bg-[#21464b]/30 px-3 text-sm text-[#f8ecc9]">
                    <input type="checkbox" checked={edition[champ]} onChange={(e) => setEdition({ ...edition, [champ]: e.target.checked })} className="h-5 w-5 accent-[#d6b66f]" />
                    {libelle}
                  </label>
                ))}
              </div>
            </fieldset>
            <input type="text" placeholder="Notes (optionnel)" value={edition.notes} onChange={(e) => setEdition({ ...edition, notes: e.target.value })} className="champ min-h-11 sm:col-span-2" />
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={enregistre} className="btn-or min-h-11 flex-1 px-4 py-2 text-sm disabled:opacity-40">{enregistre ? "Enregistrement…" : "Enregistrer"}</button>
              <button type="button" onClick={() => setFormOuvert(false)} className="min-h-11 rounded-lg border border-[#d6b66f]/40 px-4 py-2 text-sm text-[#e9d998]">Annuler</button>
            </div>
          </form>
        </section>
      )}

      {/* Historique des impressions */}
      <section className="carte p-5">
        <p className="text-xs uppercase tracking-[0.15em] text-[#a8bb87]">Historique des impressions (50 dernières)</p>
        {travaux.length === 0 ? (
          <p className="mt-3 text-sm text-[#a8bb87]">Aucune impression journalisée — l&apos;historique se remplit dès la première impression (migration 0024 requise).</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {travaux.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-[#21464b]/30 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-mono text-[#f8ecc9]">{t.reference}</span>
                  <span className="ml-2 text-xs text-[#a8bb87]">{DOCUMENT_LABEL[t.document_type] ?? t.document_type} · {FORMAT_LABEL[t.format]} · {t.copies} copie(s) · {t.langue === "ar" ? "arabe" : "français"} · {t.voie}</span>
                  {t.reimpression > 0 && <span className="ml-1 text-[10px] uppercase text-[#e9d998]">réimpression n°{t.reimpression}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-xs ${t.status === "ok" ? "text-[#69d3a8]" : "text-[#d66868]"}`}>{t.status === "ok" ? "OK" : "Erreur"}</span>
                  <span className="text-[10px] text-[#90a0b0]">{new Date(t.created_at).toLocaleString("fr-FR")}</span>
                  <button onClick={() => reimprimer(t)} className="min-h-10 rounded border border-[#d6b66f]/40 px-2 py-0.5 text-xs text-[#e9d998]">Réimprimer</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
