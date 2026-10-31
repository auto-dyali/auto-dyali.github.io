/** Fusionne des classes conditionnelles (helper léger, pas de dépendance). */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
