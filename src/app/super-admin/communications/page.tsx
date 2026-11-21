"use client";

/**
 * AUTO DYALI — Super Admin › Communications
 *
 * Prévisualisation des modèles de communication (e-mail / WhatsApp)
 * pour l'invitation Manager et la confirmation de création de garage.
 *
 * Aucun secret fournisseur n'est manipulé ici. L'envoi réel est géré
 * par les Edge Functions avec les secrets configurés côté serveur.
 * L'affichage « Envoyé » n'apparaît que si le fournisseur a confirmé.
 */

import { useState } from "react";
import Link from "next/link";
import { ModeleEmailInvitation, ModeleEmailAdminConfirmation, ModeleMessageWhatsapp } from "@/components/communication-models";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader } from "@/components/super-admin-page";
import { useNotification } from "@/lib/use-notification";

const DONNEES_TEST = {
  etablissement: { nom: "Garage Atlas SARL", slug: "garage-atlas" },
  plan: { code: "gold", label: "GOLD" },
  managerNom: "Aziz Test",
  managerLogin: "aziz.test",
  lienActivation: `${process.env.NEXT_PUBLIC_ACTIVATION_BASE_URL ?? "https://auto-dyali.staging.local"}/activer?token=abc123def456`,
  dateEcheance: "20/11/2027",
  dateFinEssai: "27/11/2026",
  dateCreation: "20/11/2026",
};

export default function CommunicationsPage() {
  const [ongletActif, setOngletActif] = useState<"email-invitation" | "whatsapp" | "email-admin">("email-invitation");
  const { success: notifySuccess, error: notifyError } = useNotification();

  return (
    <ModulePage titre="Communications">
      <ModuleHeader
        surtitre="AUTO DYALI · MEGA PRO Enterprise Premium"
        titre="Prévisualisation des communications"
        description="Prévisualisez les modèles d'e-mail et de WhatsApp avant envoi. Aucun secret fournisseur n'est manipulé ici. L'envoi réel est géré par les Edge Functions."
        action={
          <Link href="/super-admin/integrations/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">
            Configurer les fournisseurs
          </Link>
        }
      />

      {/* Onglets de prévisualisation */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setOngletActif("email-invitation")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${ongletActif === "email-invitation" ? "bg-[#5D9E7F] text-white" : "text-[#A7B7A8] hover:text-[#DFE7E2]"}`}>
          E-mail invitation Manager
        </button>
        <button
          onClick={() => setOngletActif("whatsapp")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${ongletActif === "whatsapp" ? "bg-[#5D9E7F] text-white" : "text-[#A7B7A8] hover:text-[#DFE7E2]"}`}>
          WhatsApp
        </button>
        <button
          onClick={() => setOngletActif("email-admin")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${ongletActif === "email-admin" ? "bg-[#5D9E7F] text-white" : "text-[#A7B7A8] hover:text-[#DFE7E2]"}`}>
          E-mail confirmation admin
        </button>
      </div>

      {/* Prévisualisation */}
      <div className="carte p-6 rounded-xl max-w-4xl mx-auto">
        {ongletActif === "email-invitation" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#A7B7A8]">Modèle e-mail — Invitation Manager</h3>
              <span className="text-[11px] text-[#7FBF9E]">HTML premium · Logo animé SVG · Bouton d'activation</span>
            </div>
            <div className="w-full h-[600px] overflow-auto border border-[#8FB59B]/30 rounded-lg bg-[#1a2420] p-4">
              <div dangerouslySetInnerHTML={{ __html: ModeleEmailInvitation(DONNEES_TEST) }} />
            </div>
          </>
        )}
        {ongletActif === "whatsapp" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#A7B7A8]">Modèle WhatsApp</h3>
              <span className="text-[11px] text-[#7FBF9E]">Texte brut · Logo statique de remplacement · Lien d'activation</span>
            </div>
            <div className="w-full h-[400px] overflow-auto border border-[#8FB59B]/30 rounded-lg bg-[#1a2420] p-4 font-mono text-sm text-[#a7b7a8] whitespace-pre-wrap">
              {ModeleMessageWhatsapp(DONNEES_TEST)}
            </div>
          </>
        )}
        {ongletActif === "email-admin" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#A7B7A8]">Modèle e-mail — Confirmation admin</h3>
              <span className="text-[11px] text-[#7FBF9E]">HTML · Confirmation de création garage + abonnement</span>
            </div>
            <div className="w-full h-[500px] overflow-auto border border-[#8FB59B]/30 rounded-lg bg-[#1a2420] p-4">
              <div dangerouslySetInnerHTML={{ __html: ModeleEmailAdminConfirmation(DONNEES_TEST) }} />
            </div>
          </>
        )}
      </div>

      {/* Informations de statut */}
      <div className="mt-8 max-w-4xl mx-auto grid gap-4 sm:grid-cols-3">
        <div className="carte p-5 rounded-xl">
          <h4 className="text-sm font-bold text-[#E8ECE8] mb-2">Statut e-mail</h4>
          <p className="text-[12px] text-[#A7B7A8]">Canal : <span className="font-mono text-[#DFE7E2]">Resend</span></p>
          <p className="text-[12px] text-[#A7B7A8]">Statut : <span className="text-[#C5716B]">Non configuré</span></p>
          <p className="text-[11px] text-[#A7B7A8] mt-2">Variable manquante : RESEND_API_KEY</p>
        </div>
        <div className="carte p-5 rounded-xl">
          <h4 className="text-sm font-bold text-[#E8ECE8] mb-2">Statut WhatsApp</h4>
          <p className="text-[12px] text-[#A7B7A8]">Canal : <span className="font-mono text-[#DFE7E2]">Meta WhatsApp Business</span></p>
          <p className="text-[12px] text-[#A7B7A8]">Statut : <span className="text-[#C5716B]">Non configuré</span></p>
          <p className="text-[11px] text-[#A7B7A8] mt-2">Variables manquantes : WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID</p>
        </div>
        <div className="carte p-5 rounded-xl">
          <h4 className="text-sm font-bold text-[#E8ECE8] mb-2">Sécurité</h4>
          <p className="text-[12px] text-[#A7B7A8]">Aucun mot de passe en clair</p>
          <p className="text-[12px] text-[#A7B7A8]">Lien d'activation : <span className="font-mono text-[#DFE7E2]">jeton unique</span></p>
          <p className="text-[11px] text-[#A7B7A8] mt-2">Validité : 7 jours</p>
        </div>
      </div>

      {/* Note importante */}
      <div className="mt-8 max-w-4xl mx-auto carte p-5 rounded-xl border-[#D6A34D]/30 border">
        <h4 className="text-sm font-bold text-[#D6A34D] mb-2">⚠️ Rappel important</h4>
        <ul className="text-sm text-[#A7B7A8] space-y-1 list-disc pl-4">
          <li>L'enregistrement du garage, du Manager, de l'abonnement et de l'invitation est durable dans Supabase, indépendamment de la disponibilité des fournisseurs de notification.</li>
          <li>Un échec WhatsApp ne doit pas empêcher l'e-mail, et inversement.</li>
          <li>Aucun mot de passe en clair n'est transmis dans les messages.</li>
          <li>Aucun envoi fictif n'est effectué.</li>
          <li>L'affichage « Envoyé » n'apparaît que si le fournisseur a confirmé la délivrance.</li>
        </ul>
      </div>
    </ModulePage>
  );
}
