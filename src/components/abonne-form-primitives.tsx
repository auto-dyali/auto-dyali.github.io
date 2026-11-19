"use client";

/**
 * AUTO DYALI — GV5 §76
 * Primitives de formulaire PARTAGÉES : création (onboarding 6 étapes) et
 * modification (fiche unifiée). Une seule implémentation des champs,
 * sections et pastilles — les deux parcours consomment exactement les mêmes
 * composants React, pas seulement les mêmes classes CSS.
 */

import type { ReactNode } from "react";

export function Champ3D({
  label,
  value,
  onChange,
  disabled,
  obligatoire,
  erreur,
  placeholder,
  type = "text",
  plein,
  mono,
  className,
  action,
  aide,
  ariaLabel,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  disabled?: boolean;
  obligatoire?: boolean;
  erreur?: string;
  placeholder?: string;
  type?: string;
  plein?: boolean;
  mono?: boolean;
  className?: string;
  action?: ReactNode;
  aide?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <label className={[plein ? "sa3d-plein" : "", className].filter(Boolean).join(" ") || undefined}>
      <span className="sa3d-label">
        {label}
        {obligatoire && <span className="sa3d-requis"> *</span>}
      </span>
      <span className="flex items-center gap-2">
        <input
          type={type}
          className={`sa3d-champ${mono ? " font-mono" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={Boolean(erreur)}
          aria-label={ariaLabel ?? label}
        />
        {action}
      </span>
      {aide && <span className="mt-1 block text-[0.65rem] text-[#a9bdb1]">{aide}</span>}
      {erreur && <span className="sa3d-erreur">{erreur}</span>}
    </label>
  );
}

export function Zone3D({
  label,
  value,
  onChange,
  disabled,
  lignes = 3,
  plein,
  className,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  lignes?: number;
  plein?: boolean;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={[plein ? "sa3d-plein" : "", className].filter(Boolean).join(" ") || undefined}>
      <span className="sa3d-label">{label}</span>
      <textarea
        className="sa3d-champ"
        rows={lignes}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
  );
}

export function Section3D({
  numero,
  titre,
  sousTitre,
  action,
  children,
}: {
  numero?: string;
  titre: string;
  sousTitre?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="sa3d-section">
      <div className="sa3d-section-titre">
        {numero && <span className="sa3d-section-num">{numero}</span>}
        <div className="min-w-0 flex-1">
          <h4>{titre}</h4>
          {sousTitre && <p className="sa3d-section-sous">{sousTitre}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Ligne({ label, valeur }: { label: string; valeur: ReactNode }) {
  return (
    <div className="sa3d-ligne">
      <span>{label}</span>
      <span>{valeur}</span>
    </div>
  );
}

export function Pastille({
  ton,
  texte,
}: {
  ton: "ok" | "attente" | "stop" | "neutre";
  texte: string;
}) {
  return (
    <span className={`sa3d-pill sa3d-pill--${ton}`}>
      <span className="sa3d-point" aria-hidden />
      {texte}
    </span>
  );
}

/** Récapitulatif explicite avant une opération définitive. */
export function Recapitulatif3D({
  titre,
  sousTitre,
  lignes,
  onConfirmer,
  onAnnuler,
  confirmLabel = "Confirmer",
  chargement,
}: {
  titre: string;
  sousTitre?: string;
  lignes: { label: string; valeur: ReactNode }[];
  onConfirmer: () => void;
  onAnnuler: () => void;
  confirmLabel?: string;
  chargement?: boolean;
}) {
  return (
    <div className="sa3d-panel rounded-xl p-4" role="group" aria-label={titre}>
      <p className="sa3d-surtitre">Validation explicite</p>
      <h4 className="mt-1 text-sm font-extrabold text-[#f0dcae]">{titre}</h4>
      {sousTitre && <p className="mt-1 text-xs text-[#a9bdb1]">{sousTitre}</p>}
      <div className="mt-3">
        {lignes.map((l) => (
          <Ligne key={l.label} label={l.label} valeur={l.valeur} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className="sa3d-btn sa3d-btn-fantome" onClick={onAnnuler} disabled={chargement}>
          Revenir
        </button>
        <button type="button" className="sa3d-btn sa3d-btn-vert" onClick={onConfirmer} disabled={chargement}>
          {chargement ? "Enregistrement…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
