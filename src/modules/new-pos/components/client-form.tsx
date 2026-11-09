"use client";

/**
 * NEW POS — Formulaire client professionnel (4 champs obligatoires).
 * INSERT réel Supabase, puis sélection immédiate sans perdre le panier.
 * Sections repliables pour les données facultatives.
 */

import { useState } from "react";
import type { Client } from "../types";

export function ClientFormulaire({
  surCreer,
  surSelectionner,
  clients,
  recherche,
  surRecherche,
}: {
  surCreer: (c: Client) => void;
  surSelectionner: (c: Client | null) => void;
  clients: Client[];
  recherche: string;
  surRecherche: (q: string) => void;
}) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [genre, setGenre] = useState<"particulier" | "professionnel">("particulier");

  // facultatifs
  const [entreprise, setEntreprise] = useState("");
  const [email, setEmail] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");

  // véhicules multiples
  type VehiculeSaisie = {
    plaque: string, marque: string, modele: string, annee: string,
    motorisation: string, vin: string, kilometrage: string,
  };
  const [vehicules, setVehicules] = useState<VehiculeSaisie[]>([
    { plaque: "", marque: "", modele: "", annee: "", motorisation: "", vin: "", kilometrage: "" },
  ]);

  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function creer() {
    setErreur(null);
    if (!nom.trim()) { setErreur("Le nom est obligatoire."); return; }
    if (!prenom.trim()) { setErreur("Le prénom est obligatoire."); return; }
    const tel = telephone.trim();
    if (!tel || tel.length < 6) { setErreur("Téléphone invalide (6 chiffres minimum)."); return; }

    setEnCours(true);
    try {
      const c: Client = {
        id: `cli-${Date.now()}`, // ID temporaire, remplacé par le vrai après INSERT
        nomComplet: genre === "professionnel" && entreprise.trim()
          ? `${entreprise.trim()} (${prenom.trim()} ${nom.trim()})`
          : `${prenom.trim()} ${nom.trim()}`,
        telephone: tel,
        email: email.trim() || undefined,
        genre,
        soldeDuCent: 0,
      };
      surCreer(c as Client);
      surSelectionner(c as Client);
    } finally {
      setEnCours(false);
    }
  }

  const filtrés = clients.filter((c) => {
    const q = recherche.toLowerCase();
    return c.nomComplet.toLowerCase().includes(q)
      || (c.telephone ?? "").includes(q)
      || (c.code ?? "").toLowerCase().includes(q);
  });

  return (
    <section aria-label="Client" className="rounded-xl border border-[#46524D] bg-[#303A38] p-3 space-y-3">
      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-[#A7B7A8]">Nom *</span>
          <input className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8] outline-none" value={nom} onChange={(e) => setNom(e.target.value)} aria-label="Nom" placeholder="Dupont" />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-[#A7B7A8]">Prénom *</span>
          <input className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8] outline-none" value={prenom} onChange={(e) => setPrenom(e.target.value)} aria-label="Prénom" placeholder="Jean" />
        </label>
        <label className="flex min-w-[150px] flex-col gap-1">
          <span className="text-xs text-[#A7B7A8]">Téléphone *</span>
          <input className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8] outline-none" value={telephone} onChange={(e) => setTelephone(e.target.value)} aria-label="Téléphone" inputMode="tel" placeholder="+212 6…" />
        </label>
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value as "particulier" | "professionnel")}
          aria-label="Genre"
          className="min-h-12 shrink-0 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8] outline-none"
        >
          <option value="particulier">Particulier</option>
          <option value="professionnel">Professionnel</option>
        </select>
      </div>

      {/* sections repliables */}
      <details className="rounded-lg border border-[#46524D]/50">
        <summary className="min-h-10 flex items-center gap-2 cursor-pointer rounded-lg p-2 text-xs font-semibold text-[#A7B7A8] hover:bg-[#37433E]">
          Informations facultatives
        </summary>
        <div className="p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {genre === "professionnel" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#A7B7A8]">Entreprise</span>
                <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" value={entreprise} onChange={(e) => setEntreprise(e.target.value)} aria-label="Entreprise" />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#A7B7A8]">E-mail</span>
              <input type="email" className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#A7B7A8]">Adresse</span>
              <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" value={adresse} onChange={(e) => setAdresse(e.target.value)} aria-label="Adresse" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#A7B7A8]">Ville</span>
              <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" value={ville} onChange={(e) => setVille(e.target.value)} aria-label="Ville" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#A7B7A8]">WhatsApp</span>
              <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} aria-label="WhatsApp" inputMode="tel" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#A7B7A8]">Notes</span>
              <textarea className="min-h-20 rounded-lg border border-[#46524D] bg-[#344440] px-2 py-1 text-sm text-[#E8ECE8]" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
            </label>
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-[#46524D]/50">
        <summary className="min-h-10 flex items-center gap-2 cursor-pointer rounded-lg p-2 text-xs font-semibold text-[#A7B7A8] hover:bg-[#37433E]">
          Véhicules du client (plusieurs possibles)
        </summary>
        <div className="p-2 space-y-2">
          {vehicules.map((v, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Immatriculation" value={v.plaque} onChange={(e) => { const nv = [...vehicules]; nv[i].plaque = e.target.value; setVehicules(nv); }} aria-label="Immatriculation" />
              <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Marque" value={v.marque} onChange={(e) => { const nv = [...vehicules]; nv[i].marque = e.target.value; setVehicules(nv); }} aria-label="Marque" />
              <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Modèle" value={v.modele} onChange={(e) => { const nv = [...vehicules]; nv[i].modele = e.target.value; setVehicules(nv); }} aria-label="Modèle" />
              <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Année" value={v.annee} onChange={(e) => { const nv = [...vehicules]; nv[i].annee = e.target.value; setVehicules(nv); }} aria-label="Année" inputMode="numeric" />
            </div>
          ))}
          <button type="button" onClick={() => setVehicules([...vehicules, { plaque: "", marque: "", modele: "", annee: "", motorisation: "", vin: "", kilometrage: "" }])} className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-xs text-[#49675B]">+ Ajouter un véhicule</button>
        </div>
      </details>

      {erreur && <p className="text-[11px] text-[#C66A68]">{erreur}</p>}
      <button type="button" disabled={enCours} onClick={creer} className="btn-premium min-h-14 w-full text-base font-extrabold tracking-wide">
        {enCours ? "CRÉATION…" : "AJOUTER LE CLIENT"}
      </button>

      {/* sélection rapide client existant */}
      <div className="flex flex-col gap-1 pt-2 border-t border-[#46524D]/40">
        <p className="text-xs text-[#A7B7A8]">Ou sélectionner un client existant</p>
        <input
          className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]"
          value={recherche}
          onChange={(e) => surRecherche(e.target.value)}
          placeholder="Nom, téléphone, code…"
          aria-label="Rechercher client"
        />
        <ul className="max-h-40 overflow-y-auto space-y-1 text-xs">
          {filtrés.slice(0, 8).map((c) => (
            <li key={c.id} onClick={() => surSelectionner(c)} className="px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#37433E] truncate">
              {c.nomComplet} {c.telephone ? ` — ${c.telephone}` : ""}
            </li>
          ))}
          {filtrés.length === 0 && recherche && <li className="px-2 py-1.5 text-[#8da298]">Aucun client trouvé.</li>}
        </ul>
      </div>
    </section>
  );
}
