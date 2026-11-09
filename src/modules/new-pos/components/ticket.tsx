"use client";

/**
 * NEW POS — Ticket de vente.
 * Convertit un TicketTermine en DonneesTicket (print-pro existant) et
 * rend le gabarit HTML pour impression navigateur / réimpression.
 * Jamais de fausse donnée : tout vient de la vente réellement enregistrée.
 */

import { modeleTicketHtml } from "@/lib/print-pro.ts";
import type { TicketTermine } from "../hooks/use-pos";
import { afMAD } from "../core/money.ts";

export function TicketVente({ ticket }: { ticket: TicketTermine }) {
  const lignes = ticket.lignes.map((l) => ({
    nom: l.libelle,
    quantite: l.quantite,
    prix: l.prixUnitaireCent / 100,
    remisePct: l.remisePourcent,
    tvaPct: l.tauxTva,
  }));

  const reglements = ticket.reglements.map((r) => ({
    methode: r.mode,
    montant: r.montantCent / 100,
  }));

  const donnees = {
    reference: ticket.reference,
    date: ticket.date,
    caissier: null,
    client: ticket.client?.nomComplet ?? null,
    vehicule: ticket.vehicule?.plaque ?? null,
    lignes,
    remiseTicket: ticket.totaux.remiseTotalCent / 100,
    totalTTC: ticket.totaux.ttcCent / 100,
    reglements,
    paye: ticket.reglements.reduce((s, r) => s + r.montantCent, 0) / 100,
    reste: ticket.totaux.resteDuCent / 100,
    monnaie: ticket.totaux.monnaieRendueCent / 100,
  };

  return (
    <section aria-label="Ticket de vente" className="carte-premium rounded-xl p-4 space-y-3 max-w-[320px]">
      <div className="flex items-center justify-between border-b border-[#46524D]/60 pb-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#8da298]">AUTO DYALI</p>
          <p className="text-sm font-extrabold text-[#E8ECE8]">Ticket de vente</p>
        </div>
        <span className="text-[11px] text-[#A7B7A8]">{ticket.date}</span>
      </div>

      <div className="space-y-1 text-[11px] text-[#A7B7A8]">
        <div className="flex justify-between">
          <span>Référence</span><span className="text-[#E8ECE8] font-mono">{ticket.reference}</span>
        </div>
        {ticket.client && (
          <div className="flex justify-between">
            <span>Client</span><span className="text-[#E8ECE8]">{ticket.client.nomComplet}</span>
          </div>
        )}
        {ticket.vehicule && (
          <div className="flex justify-between">
            <span>Véhicule</span><span className="text-[#E8ECE8]">{ticket.vehicule.plaque}</span>
          </div>
        )}
      </div>

      <ul className="space-y-1.5 text-sm">
        {lignes.map((l, i) => (
          <li key={i} className="flex justify-between border-b border-[#46524D]/40 pb-1 text-[11px]">
            <div className="flex flex-col">
              <span className="text-[#E8ECE8]">{l.nom}</span>
              <span className="text-[#8da298]">×{l.quantite} @ {l.prix.toFixed(2)} MAD</span>
              {l.remisePct > 0 && <span className="text-[#D6A34D]">−{l.remisePct}%</span>}
            </div>
            <span className="text-[#D0C6AE] font-mono">{ (l.quantite * l.prix).toFixed(2) }</span>
          </li>
        ))}
      </ul>

      <div className="border-t border-[#46524D]/60 pt-2 space-y-1 text-xs">
        <div className="flex justify-between"><span>Sous-total HT</span><span className="text-[#E8ECE8]">{afMAD(ticket.totaux.baseHtNetCent)}</span></div>
        <div className="flex justify-between text-[#4D9B73]"><span>Remises</span><span>−{afMAD(ticket.totaux.remiseTotalCent)}</span></div>
        {ticket.totaux.tvaParTaux.map((g: { taux: number; baseCent: number; tvaCent: number }) => (
          <div key={g.taux} className="flex justify-between"><span>TVA {g.taux === 0 ? "(exo.)" : g.taux + "%"}</span><span className="text-[#E8ECE8]">{afMAD(g.tvaCent)}</span></div>
        ))}
        <div className="flex justify-between border-t border-[#46524D]/60 pt-1 font-bold text-[#E8ECE8]">
          <span>Total TTC</span><span className="text-[#D0C6AE]">{afMAD(ticket.totaux.ttcCent)}</span>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <p className="text-[#A7B7A8]">Règlements</p>
        {reglements.map((r, i) => (
          <div key={i} className="flex justify-between text-sm"><span>{r.methode}</span><span className="text-[#E8ECE8]">{r.montant.toFixed(2)} MAD</span></div>
        ))}
        <div className="flex justify-between border-t border-[#46524D]/40 pt-1 font-bold text-[#D0C6AE]">
          <span>Montant à rendre</span><span>{afMAD(ticket.totaux.monnaieRendueCent)}</span>
        </div>
      </div>

      <p className="text-[10px] text-[#8da298] text-center">
        Merci de votre confiance — AUTO DYALI
      </p>
      <button type="button" className="btn-premium mt-3 min-h-12 w-full text-sm">
        Réimprimer le ticket
      </button>
    </section>
  );
}
