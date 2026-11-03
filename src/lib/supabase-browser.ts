import { createClient } from "@supabase/supabase-js";

// Ces deux valeurs sont des paramètres publics Supabase. Le fallback évite
// qu'un build statique GitHub Pages perde la configuration si son environnement
// n'injecte pas les variables NEXT_PUBLIC_*.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://nxmsqqoflskfajqrqddw.supabase.co";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ugGsts0KUOh1VBmYAla5hA_ZXNjZ4bT";

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
