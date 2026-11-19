import * as XLSX from "xlsx";

/**
 * AUTO DYALI — Utilitaires Excel sécurisés (import/export).
 *
 * Sécurité (GV5 §53 / xlsx) :
 * - les fichiers importés sont considérés comme non fiables ;
 * - taille et nombre de lignes sont plafonnés pour limiter les abus (ReDoS/DoS) ;
 * - le parsing ne doit jamais exécuter de contenu du fichier ;
 * - les exports sont générés à partir de données applicatives de confiance.
 */

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 Mo
export const MAX_IMPORT_ROWS = 5_000;
export const ACCEPTED_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

export type ExcelRow = Record<string, unknown>;

export function isAcceptedImportFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateImportFile(file: Pick<File, "name" | "size">): string | null {
  if (!isAcceptedImportFileName(file.name)) {
    return "Format non accepté. Utilisez un fichier .xlsx, .xls ou .csv.";
  }
  if (file.size <= 0) {
    return "Le fichier est vide.";
  }
  if (file.size > MAX_IMPORT_BYTES) {
    const mb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    return `Fichier trop volumineux (${mb} Mo). Limite : ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))} Mo.`;
  }
  return null;
}

export function readImportRows(
  buffer: ArrayBuffer,
  options?: { maxRows?: number },
): { rows: ExcelRow[]; totalRows: number; truncated: boolean } {
  const maxRows = options?.maxRows ?? MAX_IMPORT_ROWS;
  const classeur = XLSX.read(buffer, { type: "array", dense: false });
  const premiereFeuille = classeur.SheetNames[0];
  if (!premiereFeuille) {
    throw new Error("Le fichier ne contient aucune feuille.");
  }
  const sheet = classeur.Sheets[premiereFeuille];
  if (!sheet) {
    throw new Error("La première feuille est illisible.");
  }
  const lignes = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    defval: "",
  });
  const totalRows = lignes.length;
  if (totalRows > maxRows) {
    return { rows: lignes.slice(0, maxRows), totalRows, truncated: true };
  }
  return { rows: lignes, totalRows, truncated: false };
}

export type ExportSheet = {
  name: string;
  rows: Record<string, unknown>[];
  cols?: { wch: number }[];
};

export function writeWorkbook(sheets: ExportSheet[], fileName: string): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    if (sheet.cols?.length) {
      (ws as Record<string, unknown>)["!cols"] = sheet.cols;
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || "Feuille");
  }
  XLSX.writeFile(wb, fileName);
}

export function writeSingleSheetWorkbook(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
  cols?: { wch: number }[],
): void {
  writeWorkbook([{ name: sheetName, rows, cols }], fileName);
}
