"use client";

/**
 * AUTO DYALI — Sélecteur recherchable (combobox) réutilisable.
 *
 * Remplace les `<select>` des listes longues (clients, produits, fournisseurs)
 * par un contrôle réellement utilisable au clavier, à la souris et au tactile :
 *   - recherche insensible à la casse et aux accents ;
 *   - ouverture / fermeture explicites, fermeture au clic extérieur ;
 *   - navigation ArrowUp / ArrowDown / Home / End / Enter / Escape ;
 *   - valeur conservée après validation, état vide et erreur lisibles ;
 *   - panneau rendu DANS le flux (aucun débordement ni découpe dans une modale) ;
 *   - cible tactile de 44 px minimum.
 *
 * Le composant ne stocke ni ne transmet autre chose que la valeur choisie.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type ComboOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function ComboRecherche({
  options,
  value,
  onChange,
  placeholder = "Sélectionner…",
  ariaLabel,
  disabled = false,
  required = false,
  name,
  vide = "Aucun résultat.",
  className = "",
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  vide?: string;
  className?: string;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [actif, setActif] = useState(0);
  const racine = useRef<HTMLDivElement | null>(null);
  const champ = useRef<HTMLInputElement | null>(null);

  const selection = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtrees = useMemo(() => {
    const q = normaliser(recherche);
    if (!q) return options;
    return options.filter((o) => normaliser(`${o.label} ${o.hint ?? ""}`).includes(q));
  }, [options, recherche]);

  // Fermeture au clic extérieur (souris et tactile).
  useEffect(() => {
    if (!ouvert) return;
    function surClic(e: MouseEvent | TouchEvent) {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClic);
    document.addEventListener("touchstart", surClic);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("touchstart", surClic);
    };
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const timer = setTimeout(() => champ.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [ouvert]);

  function choisir(option: ComboOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOuvert(false);
    setRecherche("");
  }

  function surTouche(e: React.KeyboardEvent<HTMLElement>) {
    if (!ouvert && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOuvert(true);
      return;
    }
    if (!ouvert) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOuvert(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => Math.min(filtrees.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActif(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setActif(Math.max(0, filtrees.length - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = filtrees[actif];
      if (option) choisir(option);
    }
  }

  const libelle = selection?.label ?? placeholder;

  return (
    <div ref={racine} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        type="button"
        id={`${id}-bouton`}
        className="champ flex min-h-11 w-full items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label={ariaLabel}
        aria-controls={`${id}-liste`}
        disabled={disabled}
        onClick={() => {
          if (!ouvert) setActif(Math.max(0, options.findIndex((o) => o.value === value)));
          setOuvert(!ouvert);
        }}
        onKeyDown={surTouche}
      >
        <span className={`min-w-0 flex-1 truncate ${selection ? "" : "text-[#A7B7A8]"}`}>{libelle}</span>
        <span aria-hidden className={`shrink-0 text-xs text-[#A7B7A8] transition-transform ${ouvert ? "rotate-180" : ""}`}>▾</span>
      </button>

      {ouvert && (
        <div className="mt-1 rounded-xl border border-[#8FB59B]/25 bg-[#1d2823] p-2 shadow-xl">
          <input
            ref={champ}
            type="search"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setActif(0);
            }}
            onKeyDown={surTouche}
            placeholder="Rechercher…"
            aria-label={`Rechercher dans ${ariaLabel ?? "la liste"}`}
            aria-controls={`${id}-liste`}
            className="champ min-h-11 w-full text-sm"
          />
          <ul id={`${id}-liste`} role="listbox" aria-labelledby={`${id}-bouton`} className="mt-2 max-h-56 overflow-y-auto overscroll-contain">
            {filtrees.length === 0 && <li className="px-3 py-3 text-xs text-[#A7B7A8]">{vide}</li>}
            {filtrees.map((option, index) => {
              const choisi = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={choisi}>
                  <button
                    type="button"
                    disabled={option.disabled}
                    onClick={() => choisir(option)}
                    onMouseEnter={() => setActif(index)}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                      index === actif ? "bg-[#344440]" : ""
                    } ${choisi ? "text-[#F0DCae]" : "text-[#E8ECE8]"} disabled:opacity-40`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.hint && <span className="block truncate text-[11px] text-[#A7B7A8]">{option.hint}</span>}
                    </span>
                    {choisi && <span aria-hidden className="text-[#8FB59B]">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
