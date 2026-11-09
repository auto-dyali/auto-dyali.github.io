"use client";

/**
 * NEW POS — Écran de vente partagé (Mini-POS et POS complet).
 * Disposition commune :
 *  - PC (≥ 1024px) : catalogue | panier | paiement (3 zones, comme exigé)
 *  - Mobile : empilement avec navigation claire
 * Les 4 moyens de paiement principaux (Espèces, Visa, Mastercard, Chèque)
 * sont immédiatement visibles, jamais dans un menu caché.
 */

import { useState } from "react";
import { CatalogueVentes } from "./catalogue";
import { PanierVentes } from "./panier";
import { ClientFormulaire } from "./client-form";
import { TicketVente } from "./ticket";
import { usePos } from "../hooks/use-pos";
import { afMAD } from "../core/money.ts";
import type { ModePaiement, Reglement } from "../types";

export function PosEcran({ compact = false }: { compact?: boolean }) {
  const {
    catalogue, chargementCat,
    panier, totaux, reglements, op, vider,
    setReglements,
    clients, erreurClients, rechargerClients, choisirClient,
    estGestionnaire, permPosEdit, role,
    fileRetard, syncInfo,
    validerVenteCourante, erreurBandeau, infoValidation, ticketTermine,
  } = usePos();

  const [modeChoisi, setModeChoisi] = useState<ModePaiement>("especes");
  const [montantEspeces, setMontantEspeces] = useState("");
  const [cheque, setCheque] = useState({ numero: "", banque: "", echeance: "", statut: "en_attente" as const, date: new Date().toISOString().slice(0, 10) });
  const [refTpe, setRefTpe] = useState("");
  const [refVirement, setRefVirement] = useState("");
  const [nouveauClientOuvert, setNouveauClientOuvert] = useState(false);
  const [rechClient, setRechClient] = useState("");

  const dejaCouvert = reglements.reduce((s, r) => s + r.montantCent, 0);
  const resteACouvrir = Math.max(0, totaux.ttcCent - dejaCouvert);
  const monnaie = Math.max(0, dejaCouvert - totaux.ttcCent);
  const payeCent = dejaCouvert;

  const montantCent = Math.round(Number(montantEspeces.replace(",", ".")) * 100) || 0;

  function ajouterReglement() {
    if (montantCent <= 0) return;
    const r: Reglement = { mode: modeChoisi, montantCent };
    if (modeChoisi === "cheque") r.cheque = { ...cheque, date: new Date().toISOString().slice(0, 10) };
    if (modeChoisi === "visa" || modeChoisi === "mastercard") r.carte = { referenceTpe: refTpe.trim(), confirme: false };
    if (modeChoisi === "virement") r.virement = { reference: refVirement.trim(), confirme: false };
    setReglements([...reglements, r]);
    setMontantEspeces("");
    setRefTpe("");
    setRefVirement("");
    setCheque({ numero: "", banque: "", echeance: "", statut: "en_attente", date: new Date().toISOString().slice(0, 10) });
  }

  async function valider() {
    if (panier.lignes.length === 0) return;
    if (reglements.length === 0 && !panier.client) return;
    await validerVenteCourante(payeCent, reglements);
  }

  const peutValider =
    panier.lignes.length > 0 &&
    (resteACouvrir === 0 || (reglements.length === 0 && panier.client && (estGestionnaire || permPosEdit)));

  const MODES_PRINCIPAUX: ModePaiement[] = ["especes", "visa", "mastercard", "cheque"];
  const MODES_SECONDAIRES: ModePaiement[] = ["virement", "mobile", "credit", "avoir"];
  const MODE_LABEL: Record<ModePaiement, string> = {
    especes: "Espèces", visa: "Visa", mastercard: "Mastercard", cheque: "Chèque",
    virement: "Virement", mobile: "Mobile", credit: "Crédit", avoir: "Avoir",
  };
  const MODE_ICONE: Record<ModePaiement, string> = {
    especes: "€", visa: "VISA", mastercard: "MC", cheque: "📄",
    virement: "🏦", mobile: "📱", credit: "⏳", avoir: "🎫",
  };

  return (
    <section aria-label="Point de vente" className="flex flex-1 min-h-0 flex-col gap-2">
      {erreurBandeau && (
        <div className="rounded-lg border border-[#C66A68] bg-[#C66A68]/20 px-3 py-2 text-xs text-[#C66A68]">{erreurBandeau}</div>
      )}
      {infoValidation && (
        <div className="rounded-lg border border-[#4D9B73] bg-[#4D9B73]/20 px-3 py-2 text-xs text-[#4D9B73]">{infoValidation}</div>
      )}
      {syncInfo && <div className="rounded-lg border border-[#8da298] bg-[#8da298]/20 px-3 py-2 text-xs text-[#8da298]">{syncInfo}</div>}
      {fileRetard > 0 && (
        <div className="rounded-lg border border-[#D6A34D] bg-[#D6A34D]/20 px-3 py-2 text-xs text-[#D6A34D]">
          {fileRetard} vente(s) en attente de synchronisation (hors ligne).
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setNouveauClientOuvert(!nouveauClientOuvert)}
          className="min-h-12 rounded-lg border border-[#46524D] bg-[#303A38] px-3 text-xs text-[#E8ECE8] hover:bg-[#37433E]"
        >
          {panier.client ? `Client : ${panier.client.nomComplet}` : "Sélectionner un client"}
        </button>
        <span className="hidden lg:inline w-px bg-[#46524D] my-1"></span>
        {chargementCat && <span className="text-[10px] text-[#8da298]">chargement catalogue…</span>}
      </div>

      {nouveauClientOuvert && (
        <ClientFormulaire
          surCreer={(c) => { choisirClient(c); setNouveauClientOuvert(false); }}
          surSelectionner={choisirClient}
          clients={clients}
          recherche={rechClient}
          surRecherche={setRechClient}
        />
      )}

      {/* CORPS : 3 zones sur PC (≥1024px), empilement sur mobile */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row gap-2">
        {/* ZONE A : catalogue */}
        <div className="min-h-0 flex-1 lg:w-[40%]">
          <CatalogueVentes
            produits={catalogue.produits}
            familles={catalogue.familles}
            surAjouter={(p) => { op.ajouterProduit(p); }}
            surScan={(code) => {
              const p = catalogue.produits.find((x) => x.codeBarres === code || x.reference === code);
              if (p) op.ajouterProduit(p);
            }}
            modeTest={catalogue.mode === "test"}
            desactive={!estGestionnaire && role !== null && !permPosEdit}
          />
        </div>

        {/* ZONE B : panier */}
        <div className="min-h-0 flex-1 lg:w-[30%]">
          <PanierVentes
            lignes={panier.lignes}
            remiseGlobale={panier.remiseGlobale}
            totaux={totaux}
            surQuantite={op.majQuantite}
            surRemiseLigne={op.majRemiseLigne}
            surTvaLigne={op.majLigneTva}
            surPrixUnitaire={op.majPrixUnitaire}
            surSupprimerLigne={op.supprimerLigne}
            surRemiseGlobale={op.majRemiseGlobale}
            surVider={vider}
            posEdit={estGestionnaire || permPosEdit}
          />
        </div>

        {/* ZONE C : paiement */}
        <div className="min-h-0 flex-1 lg:w-[30%]">
          <section aria-label="Paiement" className="flex min-h-0 flex-1 flex-col gap-3">
            {/* 4 moyens principaux immédiatement visibles */}
            <div className="grid grid-cols-4 gap-2">
              {MODES_PRINCIPAUX.map((m) => {
                const actif = modeChoisi === m;
                return (
                  <button
                    key={m} type="button"
                    onClick={() => setModeChoisi(m)}
                    aria-pressed={actif}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition ${actif ? "border-[#D0C6AE] bg-[#49675B] text-[#E8ECE8]" : "border-[#46524D] bg-[#303A38] text-[#A7B7A8] hover:bg-[#37433E]"}`}
                  >
                    <span aria-hidden className="text-xl">{MODE_ICONE[m]}</span>{MODE_LABEL[m]}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MODES_SECONDAIRES.map((m) => {
                const bloque = (m === "credit" || m === "avoir") && !(estGestionnaire || permPosEdit);
                return (
                  <button
                    key={m} type="button" disabled={bloque}
                    title={bloque ? "Permission requise." : undefined}
                    onClick={() => setModeChoisi(m)}
                    aria-pressed={modeChoisi === m}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-semibold transition ${modeChoisi === m ? "border-[#D0C6AE] bg-[#49675B] text-[#E8ECE8]" : "border-[#46524D] bg-[#303A38] text-[#A7B7A8] hover:bg-[#37433E]"}${bloque ? " opacity-40" : ""}`}
                  >
                    <span aria-hidden>{MODE_ICONE[m]}</span>{MODE_LABEL[m]}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-[#46524D] bg-[#303A38] p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#A7B7A8]">
                {MODE_LABEL[modeChoisi]} — à couvrir : <b className="text-[#D0C6AE]">{afMAD(resteACouvrir)}</b>
              </p>
              {modeChoisi === "cheque" && (
                <div className="grid grid-cols-2 gap-2">
                  <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="N° chèque" value={cheque.numero} onChange={(e) => setCheque({ ...cheque, numero: e.target.value })} aria-label="N° chèque" />
                  <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Banque" value={cheque.banque} onChange={(e) => setCheque({ ...cheque, banque: e.target.value })} aria-label="Banque" />
                  <input type="date" className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" value={cheque.echeance} onChange={(e) => setCheque({ ...cheque, echeance: e.target.value })} aria-label="Échéance" />
                  <p className="col-span-2 self-center text-[10px] text-[#D6A34D]">Chèque = encaissement différé, jamais espèces.</p>
                </div>
              )}
              {(modeChoisi === "visa" || modeChoisi === "mastercard") && (
                <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Référence TPE" value={refTpe} onChange={(e) => setRefTpe(e.target.value)} aria-label="Référence TPE" />
              )}
              {modeChoisi === "virement" && (
                <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Référence virement" value={refVirement} onChange={(e) => setRefVirement(e.target.value)} aria-label="Référence virement" />
              )}
              {(modeChoisi === "credit" || modeChoisi === "avoir") && !panier.client && (
                <p className="text-[10px] text-[#C66A68]">Sélectionnez un client.</p>
              )}
              <div className="flex items-start gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[#A7B7A8]">
                  Montant (MAD)
                  <input className="min-h-10 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-right text-sm text-[#E8ECE8]" inputMode="decimal" placeholder={((resteACouvrir) / 100).toFixed(2)} value={montantEspeces} onChange={(e) => setMontantEspeces(e.target.value)} aria-label="Montant" />
                </label>
                <button type="button" disabled={montantCent <= 0} onClick={ajouterReglement} className="btn-premium min-h-10 shrink-0 px-3 text-xs">
                  Ajouter
                </button>
              </div>
              {reglements.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {reglements.map((r, i) => (
                    <li key={i} className="flex justify-between gap-2 rounded-lg border border-[#46524D] bg-[#344440] px-2 py-1">
                      <span className="text-[#E8ECE8]">{MODE_LABEL[r.mode]}</span>
                      <span className="text-[#D0C6AE] font-mono">{afMAD(r.montantCent)}</span>
                      <button type="button" onClick={() => setReglements(reglements.filter((_, j) => j !== i))} className="text-[#C66A68]">✕</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-[#46524D]/60 pt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span>Total TTC</span><span className="text-[#E8ECE8]">{afMAD(totaux.ttcCent)}</span></div>
                <div className="flex justify-between font-bold text-[#E8ECE8]">
                  <span>{monnaie > 0 ? "Monnaie" : "Reste"}</span>
                  <span className={monnaie > 0 ? "text-[#4D9B73]" : "text-[#D6A34D]"}>{afMAD(monnaie > 0 ? monnaie : resteACouvrir)}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={!peutValider}
                onClick={valider}
                className="btn-premium mt-2 min-h-12 w-full text-xs font-extrabold tracking-wide"
              >
                Valider la vente
              </button>
            </div>
          </section>
        </div>
      </div>

      {ticketTermine && <TicketVente ticket={ticketTermine} />}
    </section>
  );
}
