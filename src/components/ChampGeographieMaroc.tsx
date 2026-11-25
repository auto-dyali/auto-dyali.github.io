"use client";

/**
 * AUTO DYALI — Sélecteur géographique Pays / Région / Ville (GV5).
 *
 * - Pays : liste structurée (codes ISO + XK), libellés français ;
 * - Ville : recherche insensible aux accents et à la casse, données chargées
 *   à la demande, strictement filtrées par pays ;
 * - Maroc : 12 régions officielles et 142 villes du référentiel historique,
 *   enrichies sans perte par GeoNames (528 villes au total) ;
 * - tout changement de pays vide immédiatement la ville (et la région hors
 *   Maroc) : aucune ville d'un autre pays ne peut rester sélectionnée.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PAYS,
  chargerVillesParPays,
  libellePays,
  libelleVille,
  rechercherVilles,
  villeAppartientAuPays,
} from "@/lib/geographie";
import { REGIONS_MAROC, regionDeVille } from "@/lib/maroc-geographie";

type ChampGeographieMarocProps = {
  ville: string;
  region: string;
  country: string;
  disabled?: boolean;
  onChange: (champ: "ville" | "region" | "country", valeur: string) => void;
  erreur?: string;
  className?: string;
  labelVille?: string;
  labelRegion?: string;
  labelPays?: string;
};

const MAROC = "MA";

export function ChampGeographieMaroc({
  ville,
  region,
  country,
  disabled = false,
  onChange,
  erreur,
  className,
  labelVille = "Ville",
  labelRegion = "Région",
  labelPays = "Pays",
}: ChampGeographieMarocProps) {
  const [listes, setListes] = useState<Map<string, string[]>>(new Map());
  const [focusVille, setFocusVille] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    chargerVillesParPays()
      .then((donnees) => {
        if (actif) setListes(donnees);
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  const estMaroc = country === MAROC || country === "Maroc";
  const villesPays = useMemo(
    () => listes.get(country) ?? listes.get(MAROC) ?? [],
    [listes, country],
  );

  /** Pays : on vide TOUJOURS la ville et la région puisqu'elles sont pays-dépendantes. */
  const choixPays = useCallback(
    (code: string) => {
      onChange("country", code);
      if (code !== country) {
        onChange("ville", "");
        onChange("region", "");
      }
      setSuggestions([]);
      setFocusVille(false);
    },
    [country, onChange],
  );

  const calculSuggestions = useCallback(
    (requete: string) => {
      const trouvees = rechercherVilles(villesPays, requete);
      if (!estMaroc || !region) return trouvees;
      return trouvees.filter((v) => regionDeVille(v) === region);
    },
    [villesPays, estMaroc, region],
  );

  const choixRegion = useCallback(
    (nomRegion: string) => {
      onChange("region", nomRegion);
      if (ville && regionDeVille(ville) !== nomRegion) onChange("ville", "");
      setSuggestions([]);
      setFocusVille(false);
    },
    [ville, onChange],
  );

  const choixVille = useCallback(
    (nomVille: string) => {
      onChange("ville", nomVille);
      if (estMaroc) {
        const r = regionDeVille(nomVille);
        if (r && r !== region) onChange("region", r);
      }
      setSuggestions([]);
      setFocusVille(false);
    },
    [estMaroc, region, onChange],
  );

  const surSaisieVille = useCallback(
    (valeur: string) => {
      onChange("ville", valeur);
      setSuggestions(valeur.trim() ? calculSuggestions(valeur) : []);
      setFocusVille(Boolean(valeur.trim()));
    },
    [calculSuggestions, onChange],
  );

  /* Sécurité : si une ville chargée n'appartient pas au pays, elle est retirée. */
  useEffect(() => {
    if (!ville || listes.size === 0) return;
    if (!villeAppartientAuPays(ville, country, listes)) onChange("ville", "");
  }, [ville, country, listes, onChange]);

  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${className ?? ""}`}>
      <div className="flex flex-col gap-1">
        <label className="sa3d-label">{labelVille}</label>
        <div className="relative">
          <input
            type="text"
            value={ville}
            onChange={(e) => surSaisieVille(e.target.value)}
            onFocus={() => ville.trim() && setSuggestions(calculSuggestions(ville))}
            onBlur={() => setTimeout(() => setFocusVille(false), 150)}
            placeholder={chargement ? "Chargement des villes…" : "Rechercher une ville…"}
            disabled={disabled}
            aria-label={labelVille}
            autoComplete="off"
            className="champ w-full bg-black/40 text-[#F2F7F3]"
          />
          {focusVille && suggestions.length > 0 && !disabled && (
            <ul
              className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#8FB59B]/30 bg-[#1a2420] shadow-lg"
              role="listbox"
            >
              {suggestions.map((v) => (
                <li
                  key={`${country}-${v}`}
                  role="option"
                  aria-selected={v === ville}
                  onClick={() => choixVille(v)}
                  className="cursor-pointer px-3 py-2 text-sm text-[#F2F7F3] hover:bg-[#8FB59B]/15"
                >
                  {libelleVille(v)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[10px] text-[#A7B7A8]">
          {villesPays.length} villes disponibles — liste non exhaustive.
        </p>
        {erreur && <p className="text-[10px] text-[#C5716B]">{erreur}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="sa3d-label">{labelRegion}</label>
        <select
          value={region}
          onChange={(e) => choixRegion(e.target.value)}
          disabled={disabled || !estMaroc}
          aria-label={labelRegion}
          className="champ w-full bg-black/40 text-[#F2F7F3] disabled:bg-[#252D2D] disabled:text-[#6B7B73]"
        >
          <option value="">{estMaroc ? "Sélectionner une région…" : "Région (Maroc uniquement)"}</option>
          {estMaroc &&
            REGIONS_MAROC.map((r) => (
              <option key={r.nom} value={r.nom}>
                {r.nom}
              </option>
            ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="sa3d-label">{labelPays}</label>
        <select
          value={country}
          onChange={(e) => choixPays(e.target.value)}
          disabled={disabled}
          aria-label={labelPays}
          className="champ w-full bg-black/40 text-[#F2F7F3]"
        >
          <option value="">Sélectionner un pays…</option>
          {PAYS.map((p) => (
            <option key={p.code} value={p.code}>
              {libellePays(p.code)}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-[#A7B7A8]">
          Codes ISO ; {PAYS.length} entrées GeoNames (dont XK, code utilisateur).
        </p>
      </div>
    </div>
  );
}
