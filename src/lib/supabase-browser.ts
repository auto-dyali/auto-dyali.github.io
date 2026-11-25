import { createClient } from "@supabase/supabase-js";

// Ces deux valeurs sont des paramètres publics Supabase, fournis par
// l'environnement de build. Aucun repli en dur : un build sans variables
// pointait silencieusement vers le projet de PRODUCTION, où les RPC
// d'onboarding n'existent pas — d'où un « blocage de création » qui n'était
// en réalité qu'un mauvais environnement. Mieux vaut `null` (écran
// « Supabase non configuré ») qu'un appel invisible au mauvais projet.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
