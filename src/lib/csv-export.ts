/**
 * Export CSV côté client — échappement sûr.
 * Aucun appel réseau : l'appelant doit fournir des lignes déjà chargées.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const v = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
  return `"${v}"`;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(","));
  return lines.join("\n");
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const contenu = buildCsv(headers, rows);
  const blob = new Blob(["\ufeff" + contenu], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function dateFrCourte(v: string | null): string {
  return v ? new Date(v).toLocaleDateString("fr-FR") : "—";
}

export function formatMontant(v: number | null | undefined, currency = "MAD"): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(v);
}
