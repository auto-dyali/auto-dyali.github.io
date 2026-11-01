"use client";

import { useMemo, useState } from "react";

export type ModuleRow = {
  id: string;
  primary: string;
  secondary?: string;
  cells: string[];
  status?: string;
};

export function ModuleTable({
  rows,
  headers,
  placeholder,
  actionLabel = "Ajouter",
}: {
  rows: ModuleRow[];
  headers: string[];
  placeholder: string;
  actionLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const filtered = useMemo(
    () => rows.filter((row) => {
      const text = [row.primary, row.secondary, ...row.cells].join(" ").toLowerCase();
      return text.includes(query.toLowerCase()) && (status === "Tous" || row.status === status);
    }),
    [query, rows, status]
  );
  const statuses = ["Tous", ...Array.from(new Set(rows.map((r) => r.status).filter(Boolean)))];

  return (
    <section className="carte overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#d6b66f]/10 p-4 sm:flex-row sm:items-center">
        <input
          className="champ flex-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {statuses.length > 1 && (
          <select className="champ w-full sm:w-40" value={status} onChange={(event) => setStatus(event.target.value)}>
            {statuses.map((value) => <option key={value}>{value}</option>)}
          </select>
        )}
        <button type="button" className="btn-or whitespace-nowrap px-5 py-2.5 text-sm">+ {actionLabel}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-[#21464b]/50 text-xs uppercase tracking-wide text-[#a8bb87]">
            <tr><th className="px-4 py-3">Identité</th>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}<th className="px-4 py-3">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-[#d6b66f]/10">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-[#21464b]/30">
                <td className="px-4 py-4"><p className="font-semibold text-[#f8ecc9]">{row.primary}</p><p className="text-xs text-[#a8bb87]">{row.secondary}</p></td>
                {row.cells.map((cell, index) => <td key={`${row.id}-${index}`} className="px-4 py-4 text-[#f8ecc9]/80">{cell}</td>)}
                <td className="px-4 py-4"><button type="button" className="text-xs font-semibold text-[#d6b66f] hover:underline">Voir le détail</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun résultat.</p>}
      </div>
      <p className="border-t border-[#d6b66f]/10 px-4 py-3 text-xs text-[#a8bb87]">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>
    </section>
  );
}
