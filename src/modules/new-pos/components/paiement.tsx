"use client";

/**
 * NEW POS — Panneau de paiement (Zone D).
 * Les 4 moyens PRINCIPAUX sont immédiatement visibles (jamais dans un menu
 * caché) : Espèces, Visa, Mastercard, Chèque. Secondaires : Virement, Mobile,
 * Crédit, Avoir. Paiements MIXTES : N règlements dans la même vente.
 * Règles d'honnêteté : un chèque non encaissé / un virement non confirmé ne
 * sont jamais affichés comme encaissés ; la monnaie ne sort que des espèces.
 */

import { useState } from "react";
import { PaveNumerique } from "@/components/pave-numerique";
import { afMAD } from "../core/money.ts";
import { MOYENS_PRINCIPAUX, MOYENS_SECONDAIRES, MODE_LABEL, monnaieARendreCent } from "../core/payment-engine.ts";
import type { ModePaiement, Reglement } from "../types";
import { MODE_ICONE } from "./paiement-const.ts";

export function PanneauPaiement({
  ttcCent, reglements, surReglements,
  surValider, enCours, posEdit, clientNom,
  erreurs,
}: {
  ttcCent: number;
  reglements: Reglement[];
  surReglements: (rs: Reglement[]) => void;
  surValider: (payeCent: number, regs: Reglement[]) => void;
  enCours: boolean;
  posEdit: boolean;
  clientNom: string | null;
  erreurs: string[];
}) {
  const [mode, setMode] = useState<ModePaiement>("especes");
  const [montant, setMontant] = useState("");
  const [cheque, setCheque] = useState({ numero: "", banque: "", echeance: "", statut: "en_attente" as const });
  const [refTpe, setRefTpe] = useState("");
  const [refVirement, setRefVirement] = useState("");

  const dejaCouvert = reglements.reduce((s, r) => s + r.montantCent, 0);
  const resteACouvrir = Math.max(0, ttcCent - dejaCouvert);
  const monnaie = monnaieARendreCent(ttcCent, reglements);

  const montantCent = Math.round(Number(montant.replace(",", ".")) * 100) || 0;

  function ajouterReglement() {
    if (montantCent <= 0) return;
    const r: Reglement = { mode, montantCent };
    if (mode === "cheque") r.cheque = { ...cheque, date: new Date().toISOString().slice(0, 10) };
    if (mode === "visa" || mode === "mastercard") r.carte = { referenceTpe: refTpe.trim(), confirme: false };
    if (mode === "virement") r.virement = { reference: refVirement.trim(), confirme: false };
    surReglements([...reglements, r]);
    setMontant("");
    setRefTpe("");
    setRefVirement("");
    setCheque({ numero: "", banque: "", echeance: "", statut: "en_attente" });
  }

  const creditPur = reglements.length === 0;

  return (
    <section aria-label="Paiement" className="flex min-h-0 flex-1 flex-col gap-3">
      {/* MOYENS PRINCIPAUX — 4 boutons visibles d'un coup d'œil */}
      <div className="grid grid-cols-4 gap-2">
        {MOYENS_PRINCIPAUX.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition ${
              mode === m
                ? "border-[#D0C6AE] bg-[#49675B] text-[#E8ECE8]"
                : "border-[#46524D] bg-[#303A38] text-[#A7B7A8] hover:bg-[#37433E]"
            }`}
          >
            <span aria-hidden className="text-xl">{MODE_ICONE[m]}</span>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {MOYENS_SECONDAIRES.map((m) => {
          const bloque = (m === "credit" || m === "avoir") && !posEdit;
          return (
            <button
              key={m}
              type="button"
              disabled={bloque}
              title={bloque ? "Permission requise (pos.edit)." : undefined}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-semibold transition ${
                mode === m
                  ? "border-[#D0C6AE] bg-[#49675B] text-[#E8ECE8]"
                  : "border-[#46524D] bg-[#303A38] text-[#A7B7A8] hover:bg-[#37433E]"
              } ${bloque ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <span aria-hidden>{MODE_ICONE[m]}</span>
              {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      {/* DÉTAILS DU MODE CHOISI */}
      <div className="rounded-xl border border-[#46524D] bg-[#303A38] p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#A7B7A8]">
          {MODE_LABEL[mode]} — à couvrir : <b className="text-[#D0C6AE]">{afMAD(resteACouvrir)}</b>
        </p>

        {mode === "cheque" && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="N° chèque" value={cheque.numero} onChange={(e) => setCheque({ ...cheque, numero: e.target.value })} aria-label="Numéro de chèque" />
            <input className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Banque" value={cheque.banque} onChange={(e) => setCheque({ ...cheque, banque: e.target.value })} aria-label="Banque du chèque" />
            <input type="date" className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" value={cheque.echeance} onChange={(e) => setCheque({ ...cheque, echeance: e.target.value })} aria-label="Échéance du chèque" />
            <p className="self-center text-[11px] text-[#D6A34D]">Chèque = encaissement différé, jamais compté comme espèces.</p>
          </div>
        )}
        {(mode === "visa" || mode === "mastercard") && (
          <input className="mb-2 min-h-12 w-full rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Référence TPE (obligatoire avec terminal)" value={refTpe} onChange={(e) => setRefTpe(e.target.value)} aria-label="Référence TPE" />
        )}
        {mode === "virement" && (
          <input className="mb-2 min-h-12 w-full rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]" placeholder="Référence du virement" value={refVirement} onChange={(e) => setRefVirement(e.target.value)} aria-label="Référence de virement" />
        )}
        {(mode === "credit" || mode === "avoir") && !clientNom && (
          <p className="mb-2 text-[11px] text-[#C66A68]">Sélectionnez un client pour {MODE_LABEL[mode].toLowerCase()}.</p>
        )}
        {mode === "credit" && !posEdit && (
          <p className="mb-2 text-[11px] text-[#C66A68]">Vente à crédit : permission POS requise.</p>
        )}

        <div className="flex items-start gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[#A7B7A8]">
            Montant (MAD)
            <input
              className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-3 text-right text-base font-bold text-[#E8ECE8]"
              inputMode="decimal"
              placeholder={((resteACouvrir) / 100).toFixed(2)}
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              aria-label={`Montant en ${MODE_LABEL[mode]}`}
            />
          </label>
          <button type="button" onClick={ajouterReglement} className="btn-premium min-h-12 shrink-0 px-4 text-sm">
            Ajouter
          </button>
        </div>

        {mode === "especes" && (
          <details className="mt-2">
            <summary className="min-h-12 cursor-pointer py-3 text-xs text-[#A7B7A8]">Pavé tactile</summary>
            <PaveNumerique
              valeur={montant}
              onChangement={setMontant}
              libelleValider="Ajouter"
              onValider={ajouterReglement}
              validerDesactive={montantCent <= 0}
            />
          </details>
        )}
      </div>

      {/* RÈGLEMENTS EN COURS */}
      {reglements.length > 0 && (
        <ul className="space-y-1.5" aria-label="Règlements ajoutés">
          {reglements.map((r, i) => (
            <li key={`${r.mode}-${i}`} className="flex items-center gap-2 rounded-lg border border-[#46524D] bg-[#344440] px-3 py-1 text-xs">
              <span aria-hidden>{MODE_ICONE[r.mode]}</span>
              <b className="text-[#E8ECE8]">{MODE_LABEL[r.mode]}</b>
              <span className="ml-auto text-[#D0C6AE]">{afMAD(r.montantCent)}</span>
              {r.mode === "cheque" && r.cheque?.statut === "en_attente" && (
                <span className="text-[10px] text-[#D6A34D]">en attente</span>
              )}
              <button type="button" onClick={() => surReglements(reglements.filter((_, j) => j !== i))} aria-label={`Retirer le règlement ${MODE_LABEL[r.mode]}`} className="ml-1 min-h-12 min-w-8 text-[#C66A68]">✕</button>
            </li>
          ))}
        </ul>
      )}

      {/* TOTAUX DU RÈGLEMENT */}
      <div className="carte-premium rounded-xl p-3 text-sm">
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between text-[#A7B7A8]"><dt>Total TTC</dt><dd>{afMAD(ttcCent)}</dd></div>
          <div className="flex justify-between text-[#A7B7A8]"><dt>Couvert</dt><dd>{afMAD(Math.min(dejaCouvert, ttcCent))}</dd></div>
          <div className="flex justify-between font-bold text-[#E8ECE8]">
            <dt>{monnaie > 0 ? "Monnaie à rendre" : "Reste à payer"}</dt>
            <dd className={monnaie > 0 ? "text-[#4D9B73]" : "text-[#D6A34D]"}>
              {afMAD(monnaie > 0 ? monnaie : resteACouvrir)}
            </dd>
          </div>
        </dl>
        {creditPur && (
          <p className="mt-1 text-[11px] text-[#D6A34D]">
            Sans règlement, la vente part en CRÉDIT (client obligatoire, permission requise).
          </p>
        )}
        {erreurs.length > 0 && (
          <ul className="mt-2 space-y-1" role="alert">
            {erreurs.map((e, i) => <li key={i} className="text-[11px] text-[#C66A68]">⚠ {e}</li>)}
          </ul>
        )}
        <button
          type="button"
          disabled={enCours}
          onClick={() => surValider(dejaCouvert, reglements)}
          className="btn-premium mt-3 min-h-14 w-full text-base font-extrabold tracking-wide"
        >
          {enCours ? "ENREGISTREMENT…" : monnaie >= 0 && resteACouvrir === 0 ? "ENCAISSER" : "VALIDER LA VENTE"}
        </button>
      </div>
    </section>
  );
}
