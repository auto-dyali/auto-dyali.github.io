"use client";

/**
 * AUTO DYALI — Sélecteur géographique du Maroc.
 *
 * Remplace les champs texte manuels Ville / Région / Pays par une
 * sélection structurée :
 *   - Pays : fixe à "Maroc" (extensible)
 *   - Région : sélection parmi les 12 régions administratives officielles
 *   - Ville : autocomplétion filtrée par région
 *
 * Quand une ville est choisie, la région et le pays sont renseignés
 * automatiquement. Quand une région est choisie, la liste des villes
 * est filtrée et la ville est vidée si elle n'appartient pas à la région.
 */

import { useCallback, useMemo, useState } from "react";
import {
  PAYS_DEFAUT,
  PAYS_DISPONIBLES,
  REGIONS_MAROC,
  TOUTES_VILLES_MAROC,
  regionDeVille,
  type VilleMaroc,
} from "@/lib/maroc-geographie";

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
  const [champVilleFocus, setChampVilleFocus] = useState(false);
  const [suggestionsVille, setSuggestionsVille] = useState<string[]>([]);

  const regions = useMemo(
    () => REGIONS_MAROC.map((r) => r.nom),
    [],
  );

  const filtrerVilles = useCallback(
    (query: string) => {
      const q = query.toLowerCase().trim();
      if (!q) return [];
      return TOUTES_VILLES_MAROC.filter((v) =>
        v.toLowerCase().includes(q),
      ).slice(0, 10);
    },
    [],
  );

  const choixRegion = useCallback(
    (nomRegion: string) => {
      onChange("region", nomRegion);
      // Vider la ville si elle n'appartient pas à la nouvelle région.
      if (ville && regionDeVille(ville) !== nomRegion) {
        onChange("ville", "");
      }
    },
    [ville, onChange],
    );

  const choixVille = useCallback(
    (nomVille: string) => {
      onChange("ville", nomVille);
      const r = regionDeVille(nomVille);
      if (r && r !== region) {
        onChange("region", r);
      }
      onChange("country", PAYS_DEFAUT);
      setSuggestionsVille([]);
      setChampVilleFocus(false);
    },
    [region, onChange],
    );

  const surSaisieVille = useCallback(
    (valeur: string) => {
      onChange("ville", valeur);
      if (valeur.trim() === "") {
        setSuggestionsVille([]);
      } else {
        setSuggestionsVille(filtrerVilles(valeur));
        setChampVilleFocus(true);
      }
    },
    [filtrerVilles, onChange],
    );

  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${className ?? ""}`}>
      {/* Ville */}
      <div className="flex flex-col gap-1">
        <label className="sa3d-label">{labelVille}</label>
        <div className="relative">
          <input
            type="text"
            value={ville}
            onChange={(e) => surSaisieVille(e.target.value)}
            onFocus={() => setChampVilleFocus(true)}
            onBlur={() => setTimeout(() => setChampVilleFocus(false), 150)}
            placeholder="Nom de la ville…"
            disabled={disabled}
            className={`champ w-full ${
              disabled
                ? "bg-[#252D2D] text-[#6B7B73]"
                : "bg-black/40 text-[#F2F7F3]"
            }`}
          />
          {champVilleFocus && suggestionsVille.length > 0 && !disabled && (
            <ul className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto border border-[#8FB59B]/30 rounded-lg bg-[#1a2420] shadow-lg">
              {suggestionsVille.map((v) => (
                <li
                  key={v}
                  onClick={() => choixVille(v)}
                  className="px-3 py-2 text-sm text-[#F2F7F3] cursor-pointer hover:bg-[#8FB59B]/15"
                >
                  {v}
                </li>
              ))}
            </ul>
          )}
        </div>
        {erreur && <p className="text-[10px] text-[#C5716B]">{erreur}</p>}
      </div>

      {/* Région */}
      <div className="flex flex-col gap-1">
        <label className="sa3d-label">{labelRegion}</label>
        <select
          value={region}
          onChange={(e) => choixRegion(e.target.value)}
          disabled={disabled}
          className={`champ w-full ${
            disabled
              ? "bg-[#252D2D] text-[#6B7B73]"
              : "bg-black/40 text-[#F2F7F3]"
          }`}
        >
          <option value="">Sélectionner une région…</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Pays */}
      <div className="flex flex-col gap-1">
        <label className="sa3d-label">{labelPays}</label>
        <select
          value={country || PAYS_DEFAUT}
          onChange={(e) => onChange("country", e.target.value)}
          disabled={disabled}
          className={`champ w-full ${
            disabled
              ? "bg-[#252D2D] text-[#6B7B73]"
              : "bg-black/40 text-[#F2F7F3]"
          }`}
        >
          {PAYS_DISPONIBLES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-[#A7B7A8]">
          Valeur par défaut : {PAYS_DEFAUT}.
        </p>
      </div>
    </div>
  );
}

export type { VilleMaroc };
