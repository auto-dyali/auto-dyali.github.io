/**
 * AUTO DYALI — GV5 §77 — Stub inerte de `create-test-user`.
 *
 * L'EF temporaire créée en §66 servait à fabriquer des comptes de test.
 * Aucun outil MCP de suppression d'EF n'est disponible : on la remplace par
 * une fonction qui refuse toute création et ne manipule aucun secret.
 * La suppression définitive reste possible depuis le dashboard Supabase.
 */

// Déclaration locale : ce fichier est documentaire dans le dépôt et exécuté
// par le runtime Deno de Supabase (aucun type Deno dans le projet Next.js).
declare const Deno: { serve(handler: () => Response): void };

const headers = { "Content-Type": "application/json" };

Deno.serve((): Response => {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Fonction de test désactivée en GV5 §77. Aucun compte ne peut être créé.",
    }),
    { status: 410, headers },
  );
});
